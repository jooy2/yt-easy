// DOM helpers for the Watch later page, shared by the collector's fallback
// path and the remover.
(() => {
  const ns = (globalThis.ytEasy ??= {});
  const { SELECTORS, WATCH_LATER_LIST_ID, util } = ns;

  const LOAD_MORE_TIMEOUT = 15000;

  const isWatchLaterPage = () => {
    const params = new URLSearchParams(location.search);

    return location.pathname === '/playlist' && params.get('list') === WATCH_LATER_LIST_ID;
  };

  const isVisible = () => document.visibilityState === 'visible';

  const getPlaylistRoot = () => document.querySelector(SELECTORS.playlistPage);

  const getItemElements = () => {
    const root = getPlaylistRoot();

    return root ? [...root.querySelectorAll(SELECTORS.item)] : [];
  };

  // Reads the video ID from a link, but only for links into Watch later.
  // Other lists on the page, such as a recommendation shelf, are ignored.
  const readVideoIdFromLink = (link) => {
    const url = new URL(link.getAttribute('href') ?? '', location.origin);

    if (url.searchParams.get('list') !== WATCH_LATER_LIST_ID) {
      return null;
    }

    const videoId = url.searchParams.get('v');

    return util.isVideoId(videoId) ? videoId : null;
  };

  const readItemVideoId = (item) => {
    for (const link of item.querySelectorAll(SELECTORS.itemLink)) {
      const videoId = readVideoIdFromLink(link);

      if (videoId) {
        return videoId;
      }
    }

    return null;
  };

  // Finds the row of one video among the rows loaded so far. Elements are
  // reused as rows are removed, so this always searches the current DOM
  // instead of trusting an earlier lookup.
  const findItemElement = (videoId) => {
    const root = getPlaylistRoot();

    if (!root || !util.isVideoId(videoId)) {
      return null;
    }

    for (const link of root.querySelectorAll(`a[href*="v=${videoId}"]`)) {
      if (readVideoIdFromLink(link) !== videoId) {
        continue;
      }

      const item = link.closest(SELECTORS.item);

      if (item && item.getClientRects().length > 0) {
        return item;
      }
    }

    return null;
  };

  // Waits while the tab is in the background. Chrome pauses rendering there,
  // so YouTube neither loads more rows nor opens menus until it is shown.
  const waitUntilVisible = ({ signal, onPause } = {}) => {
    if (isVisible()) {
      return Promise.resolve();
    }

    onPause?.();

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        document.removeEventListener('visibilitychange', onChange);
        signal?.removeEventListener('abort', onAbort);
      };
      const onChange = () => {
        if (isVisible()) {
          cleanup();
          resolve();
        }
      };
      const onAbort = () => {
        cleanup();
        reject(util.createAbortError());
      };

      document.addEventListener('visibilitychange', onChange);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  };

  // Scrolls the end-of-list placeholder into view, the way a person scrolling
  // down would, and waits for YouTube to append the next page.
  // Returns 'loaded', 'end' (nothing more to load) or 'stalled'.
  const loadMore = async ({ signal, onPause } = {}) => {
    const root = getPlaylistRoot();
    const continuation = root?.querySelector(SELECTORS.continuation);

    if (!continuation) {
      return 'end';
    }

    await waitUntilVisible({ signal, onPause });

    const before = getItemElements().length;

    continuation.scrollIntoView({ block: 'end' });

    const changed = await util.waitFor(
      () => getItemElements().length > before || !continuation.isConnected,
      { timeout: LOAD_MORE_TIMEOUT, interval: 250, signal },
    );

    if (!changed) {
      return 'stalled';
    }

    return getItemElements().length > before ? 'loaded' : 'end';
  };

  ns.page = {
    isWatchLaterPage,
    isVisible,
    getPlaylistRoot,
    getItemElements,
    readItemVideoId,
    findItemElement,
    waitUntilVisible,
    loadMore,
  };
})();
