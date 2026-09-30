// Reads the whole Watch later list.
//
// The primary path fetches the Watch later page, reads the first part of the
// list from its embedded `ytInitialData`, and then requests the rest with the
// same continuation request the page sends while you scroll. It does not need
// thousands of rows rendered, works while the tab is in the background, and
// returns channel IDs and exact durations.
//
// If that path fails, the fallback scrolls the open Watch later tab to the end
// and reads the rows from the DOM.
(() => {
  const ns = (globalThis.ytEasy ??= {});
  const { PAGE_DATA, SELECTORS, WATCH_LATER_LIST_ID, WATCH_LATER_PATH, util } = ns;

  const MAX_PAGES = 200;
  const PAGE_DELAY_MIN = 800;
  const PAGE_DELAY_MAX = 1600;
  const RETRY_DELAYS = [3000, 8000];
  const SKIP_KEYS = new Set(PAGE_DATA.skipKeys);

  class CollectError extends Error {
    constructor(message, { code = 'failed' } = {}) {
      super(message);
      this.name = 'CollectError';
      this.code = code;
    }
  }

  // ---------------------------------------------------------------------------
  // Embedded JSON in the page HTML

  // Parses the JSON object that starts at `start`, finding its end by
  // matching braces outside of strings.
  const readJsonObjectAt = (text, start) => {
    if (text[start] !== '{') {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }

        continue;
      }

      if (char === '"') {
        inString = true;
      } else if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;

        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, index + 1));
          } catch {
            return null;
          }
        }
      }
    }

    return null;
  };

  const findAssignedObject = (html, markers) => {
    for (const marker of markers) {
      const index = html.indexOf(marker);

      if (index === -1) {
        continue;
      }

      const value = readJsonObjectAt(html, index + marker.length);

      if (value) {
        return value;
      }
    }

    return null;
  };

  // The page calls `ytcfg.set({...})` more than once; later calls add keys.
  const readConfig = (html) => {
    const config = {};
    const marker = PAGE_DATA.configMarker;
    let from = 0;

    while (true) {
      const index = html.indexOf(marker, from);

      if (index === -1) {
        break;
      }

      const start = index + marker.length - 1;

      Object.assign(config, readJsonObjectAt(html, start) ?? {});
      from = start + 1;
    }

    return config;
  };

  // ---------------------------------------------------------------------------
  // Reading one list entry

  const readText = (value) => {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value?.content === 'string') {
      return value.content;
    }

    if (typeof value?.simpleText === 'string') {
      return value.simpleText;
    }

    if (Array.isArray(value?.runs)) {
      return value.runs.map((run) => run.text ?? '').join('');
    }

    return '';
  };

  // Depth-first search for the first value `pick` accepts.
  const findDeep = (node, pick) => {
    if (!node || typeof node !== 'object') {
      return null;
    }

    const picked = pick(node);

    if (picked != null) {
      return picked;
    }

    for (const value of Array.isArray(node) ? node : Object.values(node)) {
      const found = findDeep(value, pick);

      if (found != null) {
        return found;
      }
    }

    return null;
  };

  const findBrowseId = (node) => findDeep(node, (value) => {
    const id = value.browseEndpoint?.browseId;

    return typeof id === 'string' && id.startsWith('UC') ? id : null;
  });

  const findContinuationToken = (node) => findDeep(node, (value) => {
    const token = value.continuationCommand?.token;

    return typeof token === 'string' && token ? token : null;
  });

  const pickLargestImage = (sources) => {
    if (!Array.isArray(sources) || sources.length === 0) {
      return '';
    }

    const largest = sources.reduce((best, source) => ((source.width ?? 0) > (best.width ?? 0) ? source : best));

    return typeof largest.url === 'string' ? largest.url : '';
  };

  // The label of the menu entry that removes this video from the list, in
  // the account's UI language. Found by the action it runs, not its wording.
  const findRemoveLabel = (menu) => findDeep(menu, (value) => {
    const entry = value.listItemViewModel ?? value.menuServiceItemRenderer;

    if (!entry) {
      return null;
    }

    const removes = findDeep(entry, (inner) => {
      const actions = inner.playlistEditEndpoint?.actions;

      return Array.isArray(actions)
        && actions.some((action) => String(action.action ?? '').startsWith(PAGE_DATA.removeActionPrefix))
        ? true
        : null;
    });

    if (!removes) {
      return null;
    }

    return readText(entry.title ?? entry.text).trim() || null;
  });

  const readDurationBadge = (contentImage) => {
    const texts = [];

    findDeep(contentImage, (value) => {
      const text = value.thumbnailBadgeViewModel?.text;

      if (typeof text === 'string') {
        texts.push(text);
      }

      return null;
    });

    return texts.find((text) => util.parseDurationText(text) != null) ?? texts[0] ?? '';
  };

  const clampPercent = (value) => {
    const number = Number(value);

    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : null;
  };

  // The red bar YouTube draws under the thumbnail of a video you started. A
  // segmented bar marks a part of the video rather than what was watched, so
  // it is skipped. No bar means the video was not watched, or YouTube keeps
  // no watch history for the account.
  const readWatchedPercent = (contentImage) => findDeep(contentImage, (value) => {
    const bar = value[PAGE_DATA.watchedBarKey];

    if (!bar || bar.enableSegmentView) {
      return null;
    }

    return clampPercent(bar.startPercent);
  });

  const hasMusicBadge = (contentImage) => Boolean(findDeep(contentImage, (value) => {
    const icon = value.thumbnailBadgeViewModel?.icon;

    if (!icon) {
      return null;
    }

    return findDeep(icon, (inner) => (inner.clientResource?.imageName === PAGE_DATA.musicBadgeImage ? true : null));
  }));

  const readLockup = (lockup, listId) => {
    if (lockup.contentType && lockup.contentType !== PAGE_DATA.videoContentType) {
      return null;
    }

    const watch = lockup.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint;

    if (watch?.playlistId && watch.playlistId !== listId) {
      return null;
    }

    const videoId = lockup.contentId ?? watch?.videoId;

    if (!util.isVideoId(videoId)) {
      return null;
    }

    const metadata = lockup.metadata?.lockupMetadataViewModel;
    const channelPart = metadata?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0];
    const durationText = readDurationBadge(lockup.contentImage);

    return {
      item: {
        videoId,
        title: readText(metadata?.title),
        channelName: readText(channelPart?.text),
        channelId: findBrowseId(channelPart) ?? findBrowseId(metadata?.image) ?? '',
        durationSeconds: util.parseDurationText(durationText),
        durationText,
        thumbnail: pickLargestImage(lockup.contentImage?.thumbnailViewModel?.image?.sources),
        watchedPercent: readWatchedPercent(lockup.contentImage),
        musicBadge: hasMusicBadge(lockup.contentImage),
      },
      removeLabel: findRemoveLabel(metadata?.menuButton),
    };
  };

  const readLegacyRenderer = (renderer) => {
    if (!util.isVideoId(renderer.videoId)) {
      return null;
    }

    const durationText = readText(renderer.lengthText);
    const lengthSeconds = Number.parseInt(renderer.lengthSeconds, 10);

    return {
      item: {
        videoId: renderer.videoId,
        title: readText(renderer.title),
        channelName: readText(renderer.shortBylineText),
        channelId: findBrowseId(renderer.shortBylineText) ?? '',
        durationSeconds: Number.isFinite(lengthSeconds) ? lengthSeconds : util.parseDurationText(durationText),
        durationText,
        thumbnail: pickLargestImage(renderer.thumbnail?.thumbnails),
        watchedPercent: findDeep(renderer.thumbnailOverlays, (value) => clampPercent(value[PAGE_DATA.legacyWatchedKey]?.percentDurationWatched)),
      },
      removeLabel: findRemoveLabel(renderer.menu),
    };
  };

  // ---------------------------------------------------------------------------
  // Reading a page of browse data

  const isListEntry = (entry) => Boolean(
    entry && (entry[PAGE_DATA.itemKeys.lockup] || entry[PAGE_DATA.itemKeys.legacy]),
  );

  // Collects the entries of `listId` from `ytInitialData` or a continuation
  // response. The continuation token is only taken from an array that held
  // entries of the list, so a token that belongs to a recommendation shelf
  // cannot pull unrelated videos in.
  const readBrowseData = (data, listId = WATCH_LATER_LIST_ID) => {
    const result = { items: [], token: null, removeLabel: null };

    const readArray = (array) => {
      const items = [];
      let token = null;

      for (const entry of array) {
        let read = null;

        if (entry?.[PAGE_DATA.itemKeys.lockup]) {
          read = readLockup(entry[PAGE_DATA.itemKeys.lockup], listId);
        } else if (entry?.[PAGE_DATA.itemKeys.legacy]) {
          read = readLegacyRenderer(entry[PAGE_DATA.itemKeys.legacy]);
        } else {
          const key = PAGE_DATA.continuationKeys.find((name) => entry?.[name]);

          if (key) {
            token = findContinuationToken(entry[key]);
          }
        }

        if (read) {
          items.push(read.item);
          result.removeLabel ??= read.removeLabel;
        }
      }

      if (items.length > 0) {
        result.items.push(...items);
        result.token = token ?? result.token;
      }
    };

    const visit = (node) => {
      if (!node || typeof node !== 'object') {
        return;
      }

      if (Array.isArray(node)) {
        if (node.some(isListEntry)) {
          readArray(node);
          return;
        }

        node.forEach(visit);
        return;
      }

      for (const [key, value] of Object.entries(node)) {
        if (!SKIP_KEYS.has(key)) {
          visit(value);
        }
      }
    };

    visit(data);

    return result;
  };

  // ---------------------------------------------------------------------------
  // Signed requests

  const readCookies = () => new Map(document.cookie.split(';').map((part) => {
    const index = part.indexOf('=');

    return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));

  const sha1Hex = async (text) => {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));

    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  // Builds the Authorization header the YouTube web client sends with its
  // own requests. The cookie values stay in this tab; only their hash leaves.
  const buildAuthorization = async () => {
    const cookies = readCookies();
    const timestamp = Math.floor(Date.now() / 1000);
    const parts = [];

    for (const { cookies: names, scheme } of PAGE_DATA.authCookies) {
      const value = names.map((name) => cookies.get(name)).find(Boolean);

      if (!value) {
        continue;
      }

      const hash = await sha1Hex(`${timestamp} ${value} ${location.origin}`);

      parts.push(`${scheme} ${timestamp}_${hash}`);
    }

    return parts.join(' ');
  };

  const buildHeaders = async (config) => {
    const headers = {
      'Content-Type': 'application/json',
      'X-Origin': location.origin,
      'X-Goog-AuthUser': String(config.SESSION_INDEX ?? 0),
      'X-Youtube-Client-Name': String(config.INNERTUBE_CONTEXT_CLIENT_NAME ?? 1),
      'X-Youtube-Client-Version': String(config.INNERTUBE_CLIENT_VERSION ?? ''),
    };
    const authorization = await buildAuthorization();

    if (authorization) {
      headers.Authorization = authorization;
    }

    if (config.VISITOR_DATA) {
      headers['X-Goog-Visitor-Id'] = config.VISITOR_DATA;
    }

    if (config.DELEGATED_SESSION_ID) {
      headers['X-Goog-PageId'] = config.DELEGATED_SESSION_ID;
    }

    if (config.LOGGED_IN) {
      headers['X-Youtube-Bootstrap-Logged-In'] = 'true';
    }

    return headers;
  };

  const requestContinuation = async ({ config, token, signal }) => {
    const url = new URL(PAGE_DATA.browsePath, location.origin);

    url.searchParams.set('prettyPrint', 'false');

    for (let attempt = 0; ; attempt += 1) {
      let response = null;

      try {
        response = await fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: await buildHeaders(config),
          body: JSON.stringify({ context: config.INNERTUBE_CONTEXT, continuation: token }),
          signal,
        });
      } catch (error) {
        if (util.isAbortError(error) || attempt >= RETRY_DELAYS.length) {
          throw error;
        }
      }

      if (response?.ok) {
        return response.json();
      }

      const retryable = !response || response.status === 429 || response.status >= 500;

      if (!retryable || attempt >= RETRY_DELAYS.length) {
        throw new CollectError(`목록의 다음 부분을 받지 못했습니다 (HTTP ${response?.status ?? '오류'}).`);
      }

      await util.sleep(RETRY_DELAYS[attempt], signal);
    }
  };

  // ---------------------------------------------------------------------------
  // Collection paths

  const createItemStore = () => {
    const items = new Map();

    const add = (list) => {
      let added = 0;

      for (const item of list) {
        if (!items.has(item.videoId)) {
          items.set(item.videoId, { ...item, position: items.size + 1 });
          added += 1;
        }
      }

      return added;
    };

    return { add, values: () => [...items.values()], get size() { return items.size; } };
  };

  const collectFromData = async ({ signal, onProgress }) => {
    const response = await fetch(new URL(WATCH_LATER_PATH, location.origin), { credentials: 'same-origin', signal });

    if (!response.ok) {
      throw new CollectError(`나중에 볼 동영상 페이지를 불러오지 못했습니다 (HTTP ${response.status}).`);
    }

    const html = await response.text();
    const config = readConfig(html);

    if (config.LOGGED_IN === false) {
      throw new CollectError('YouTube에 로그인되어 있지 않습니다. 로그인한 뒤 다시 시도해 주세요.', { code: 'signed-out' });
    }

    const data = findAssignedObject(html, PAGE_DATA.initialDataMarkers);

    if (!data || !config.INNERTUBE_CONTEXT) {
      throw new CollectError('페이지에서 목록 데이터를 찾지 못했습니다.');
    }

    const store = createItemStore();
    let page = readBrowseData(data);
    let removeLabel = page.removeLabel;
    let pages = 1;

    store.add(page.items);
    onProgress?.({ count: store.size, pages });

    while (page.token) {
      if (pages >= MAX_PAGES) {
        throw new CollectError('목록이 예상보다 깁니다. 스캔을 멈췄습니다.');
      }

      await util.sleep(util.randomBetween(PAGE_DELAY_MIN, PAGE_DELAY_MAX), signal);

      const token = page.token;

      page = readBrowseData(await requestContinuation({ config, token, signal }));

      // A token means more entries exist, so a page without new entries is a
      // failed request (for example, one YouTube answered as signed out), not
      // the end of the list. Stopping here would return a silently short list.
      if (store.add(page.items) === 0) {
        throw new CollectError('목록의 다음 부분이 비어 있습니다. 로그인 상태를 확인해 주세요.');
      }

      removeLabel ??= page.removeLabel;
      pages += 1;
      onProgress?.({ count: store.size, pages });
    }

    if (store.size === 0) {
      throw new CollectError('목록에서 영상을 찾지 못했습니다.', { code: 'empty' });
    }

    return { items: store.values(), removeLabel, method: 'data' };
  };

  const decodeHandle = (handle) => {
    try {
      return decodeURIComponent(handle);
    } catch {
      return handle;
    }
  };

  // Rows in the DOM link to `/channel/UC...` or to `/@handle`; a handle is
  // kept as the channel ID when that is all the row offers.
  const readChannel = (link) => {
    const href = link?.getAttribute('href') ?? '';
    const match = /^\/(?:channel\/(UC[\w-]+)|(@[^/?#]+))/.exec(href);

    return {
      channelName: util.textOf(link),
      channelId: match ? (match[1] ?? decodeHandle(match[2])) : '',
    };
  };

  const readItemElement = (element) => {
    const videoId = ns.page.readItemVideoId(element);

    if (!videoId) {
      return null;
    }

    const titleElement = element.querySelector(SELECTORS.itemTitle);
    const durationText = util.textOf(element.querySelector(SELECTORS.itemDuration));
    const watchedBar = element.querySelector(SELECTORS.itemWatchedBar);

    return {
      videoId,
      title: titleElement?.getAttribute('title') || util.textOf(titleElement),
      ...readChannel(element.querySelector(SELECTORS.itemChannelLink)),
      durationSeconds: util.parseDurationText(durationText),
      durationText,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      watchedPercent: watchedBar ? clampPercent(Number.parseFloat(watchedBar.style.width)) : null,
    };
  };

  const collectFromDom = async ({ signal, onProgress }) => {
    const { page } = ns;

    if (!page.isWatchLaterPage() || !page.getPlaylistRoot()) {
      throw new CollectError('나중에 볼 동영상 페이지에서만 스크롤 방식으로 스캔할 수 있습니다.', { code: 'needs-page' });
    }

    const onPause = () => onProgress?.({ count: page.getItemElements().length, paused: true });

    while (true) {
      const state = await page.loadMore({ signal, onPause });

      onProgress?.({ count: page.getItemElements().length });

      if (state === 'end') {
        break;
      }

      if (state === 'stalled') {
        throw new CollectError('목록을 끝까지 불러오지 못했습니다. 탭을 새로고침한 뒤 다시 시도해 주세요.');
      }

      await util.sleep(util.randomBetween(PAGE_DELAY_MIN, PAGE_DELAY_MAX), signal);
    }

    const store = createItemStore();

    store.add(page.getItemElements().map(readItemElement).filter(Boolean));

    return { items: store.values(), removeLabel: null, method: 'dom' };
  };

  // mode 'auto' tries the page data first and falls back to scrolling when
  // this tab is the visible Watch later page. mode 'dom' only scrolls.
  const collect = async ({ mode = 'auto', signal, onProgress } = {}) => {
    if (mode === 'dom') {
      return collectFromDom({ signal, onProgress });
    }

    try {
      return await collectFromData({ signal, onProgress });
    } catch (error) {
      if (util.isAbortError(error) || error.code === 'signed-out') {
        throw error;
      }

      if (ns.page.isWatchLaterPage() && ns.page.isVisible()) {
        return collectFromDom({ signal, onProgress });
      }

      // Network and parse errors arrive with English browser messages.
      const message = error instanceof CollectError ? error.message : '네트워크 오류로 목록을 받지 못했습니다.';

      // The manager brings the tab to the front and asks again with 'dom'.
      throw new CollectError(message, { code: 'needs-dom' });
    }
  };

  ns.collector = {
    CollectError,
    readJsonObjectAt,
    findAssignedObject,
    readConfig,
    readBrowseData,
    collect,
  };
})();
