import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadContentScripts, plain } from './helpers/content-scripts.mjs';
import {
  REMOVE_LABEL,
  continuationEntry,
  continuationResponse,
  initialData,
  lockup,
  pageHtml,
  videoId,
} from './helpers/fixtures.mjs';

const CONFIG = {
  LOGGED_IN: true,
  SESSION_INDEX: '0',
  INNERTUBE_CLIENT_VERSION: '2.20260928.00.00',
  INNERTUBE_CONTEXT_CLIENT_NAME: 1,
  INNERTUBE_CONTEXT: { client: { clientName: 'WEB', clientVersion: '2.20260928.00.00' } },
  VISITOR_DATA: 'visitor-data',
};

describe('util.parseDurationText', () => {
  const { util } = loadContentScripts();

  it('reads minutes and hours', () => {
    assert.equal(util.parseDurationText('4:05'), 245);
    assert.equal(util.parseDurationText('1:02:03'), 3723);
    assert.equal(util.parseDurationText(' 12:00 '), 720);
  });

  it('returns null for anything that is not a duration', () => {
    assert.equal(util.parseDurationText('LIVE'), null);
    assert.equal(util.parseDurationText(''), null);
    assert.equal(util.parseDurationText('4:5'), null);
    assert.equal(util.parseDurationText(undefined), null);
  });
});

describe('reading embedded JSON', () => {
  const { collector } = loadContentScripts();

  it('finds the end of an object with braces and quotes inside strings', () => {
    const text = 'x = {"a":"}{","b":{"c":"say \\"hi\\" {"}};rest';
    const value = collector.readJsonObjectAt(text, text.indexOf('{'));

    assert.deepEqual(plain(value), { a: '}{', b: { c: 'say "hi" {' } });
  });

  it('returns null for an unterminated object', () => {
    assert.equal(collector.readJsonObjectAt('{"a":1', 0), null);
  });

  it('reads ytInitialData and merges every ytcfg.set call', () => {
    const data = initialData([lockup({ videoId: videoId(1) })]);
    const html = pageHtml({ data, config: CONFIG });
    const found = collector.findAssignedObject(html, ['var ytInitialData = ']);
    const config = collector.readConfig(html);

    assert.deepEqual(plain(found), data);
    assert.equal(config.CLIENT_CANARY_STATE, 'none');
    assert.equal(config.INNERTUBE_CLIENT_VERSION, CONFIG.INNERTUBE_CLIENT_VERSION);
  });
});

describe('collector.readBrowseData', () => {
  const { collector } = loadContentScripts();

  it('reads each field of a lockup entry', () => {
    const data = initialData([
      lockup({ videoId: videoId(1), title: 'First', channel: 'Channel A', channelId: 'UCchannelAAAAAAAAAAAAAAA', duration: '1:02:03' }),
      continuationEntry('token-2'),
    ]);
    const page = plain(collector.readBrowseData(data));

    assert.equal(page.token, 'token-2');
    assert.equal(page.removeLabel, REMOVE_LABEL);
    assert.deepEqual(page.items, [{
      videoId: videoId(1),
      title: 'First',
      channelName: 'Channel A',
      channelId: 'UCchannelAAAAAAAAAAAAAAA',
      durationSeconds: 3723,
      durationText: '1:02:03',
      thumbnail: `https://i.ytimg.com/vi/${videoId(1)}/hqdefault.jpg?size=large`,
      watchedPercent: null,
    }]);
  });

  it('reads how much of a video was watched, but not a segment bar', () => {
    const data = initialData([
      lockup({ videoId: videoId(1), watched: 45 }),
      lockup({ videoId: videoId(2), watched: 100 }),
      lockup({ videoId: videoId(3), watched: 30, segmented: true }),
    ]);

    assert.deepEqual(plain(collector.readBrowseData(data)).items.map((item) => item.watchedPercent), [45, 100, null]);
  });

  it('ignores entries of other lists and their continuation', () => {
    const shelf = {
      itemSectionRenderer: {
        contents: [{
          horizontalShelfViewModel: {
            items: [lockup({ videoId: videoId(9), listId: 'PLother' }), continuationEntry('shelf-token')],
          },
        }],
      },
    };
    const data = initialData([lockup({ videoId: videoId(1) }), lockup({ videoId: videoId(2) })], [
      shelf,
      continuationEntry('section-token'),
    ]);
    const page = plain(collector.readBrowseData(data));

    assert.deepEqual(page.items.map((item) => item.videoId), [videoId(1), videoId(2)]);
    assert.equal(page.token, null);
  });

  it('skips lockups that are not videos', () => {
    const data = initialData([
      lockup({ videoId: videoId(1) }),
      lockup({ videoId: videoId(2), contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST' }),
    ]);

    assert.deepEqual(plain(collector.readBrowseData(data)).items.map((item) => item.videoId), [videoId(1)]);
  });

  it('keeps the badge text when it is not a duration', () => {
    const data = initialData([lockup({ videoId: videoId(1), duration: 'LIVE' })]);
    const [item] = plain(collector.readBrowseData(data)).items;

    assert.equal(item.durationSeconds, null);
    assert.equal(item.durationText, 'LIVE');
  });

  it('reads a continuation response', () => {
    const response = continuationResponse([lockup({ videoId: videoId(101) }), continuationEntry('token-3')]);
    const page = plain(collector.readBrowseData(response));

    assert.deepEqual(page.items.map((item) => item.videoId), [videoId(101)]);
    assert.equal(page.token, 'token-3');
  });

  it('still reads the older playlistVideoRenderer entries', () => {
    const data = initialData([{
      playlistVideoRenderer: {
        videoId: videoId(1),
        title: { runs: [{ text: 'Old ' }, { text: 'layout' }] },
        shortBylineText: {
          runs: [{ text: 'Channel B', navigationEndpoint: { browseEndpoint: { browseId: 'UCchannelBBBBBBBBBBBBBBB' } } }],
        },
        lengthSeconds: '754',
        lengthText: { simpleText: '12:34' },
        thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/x/1.jpg', width: 120 }] },
        thumbnailOverlays: [{ thumbnailOverlayResumePlaybackRenderer: { percentDurationWatched: 30 } }],
        menu: {
          menuRenderer: {
            items: [{
              menuServiceItemRenderer: {
                text: { runs: [{ text: 'Remove from Watch later' }] },
                serviceEndpoint: { playlistEditEndpoint: { actions: [{ action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID' }] } },
              },
            }],
          },
        },
      },
    }]);
    const page = plain(collector.readBrowseData(data));

    assert.equal(page.removeLabel, 'Remove from Watch later');
    assert.deepEqual(page.items[0], {
      videoId: videoId(1),
      title: 'Old layout',
      channelName: 'Channel B',
      channelId: 'UCchannelBBBBBBBBBBBBBBB',
      durationSeconds: 754,
      durationText: '12:34',
      thumbnail: 'https://i.ytimg.com/vi/x/1.jpg',
      watchedPercent: 30,
    });
  });
});

describe('collector.collect through page data', () => {
  const PAGE_SIZE = 3;

  // Three pages of three videos: the page HTML, then two continuations.
  const createSite = ({ breakSecondPage = false } = {}) => {
    const requests = [];
    const page = (index, token) => [
      ...Array.from({ length: PAGE_SIZE }, (_, offset) => lockup({ videoId: videoId(index * PAGE_SIZE + offset + 1) })),
      ...(token ? [continuationEntry(token)] : []),
    ];
    const responses = {
      'token-1': continuationResponse(breakSecondPage ? [continuationEntry('token-2')] : page(1, 'token-2')),
      'token-2': continuationResponse(page(2, null)),
    };

    const fetch = async (input, init = {}) => {
      const url = new URL(input, 'https://www.youtube.com');

      requests.push({ url: url.pathname + url.search, init });

      if (url.pathname === '/playlist') {
        return new Response(pageHtml({ data: initialData(page(0, 'token-1')), config: CONFIG }));
      }

      const { continuation } = JSON.parse(init.body);

      return new Response(JSON.stringify(responses[continuation]), { headers: { 'Content-Type': 'application/json' } });
    };

    return { fetch, requests };
  };

  const loadWith = (site) => loadContentScripts({
    fetch: site.fetch,
    location: new URL('https://www.youtube.com/playlist?list=WL'),
    document: {
      cookie: 'PREF=f6=40000000; SAPISID=sapisid-value; __Secure-1PAPISID=one-p; __Secure-3PAPISID=three-p',
      visibilityState: 'hidden',
    },
    // Skip the pauses between requests.
    setTimeout: (callback) => setImmediate(callback),
  });

  it('follows the continuation to the end and numbers the list', async () => {
    const site = createSite();
    const { collector } = loadWith(site);
    const progress = [];
    const result = plain(await collector.collect({ onProgress: (entry) => progress.push(entry.count) }));

    assert.equal(result.method, 'data');
    assert.equal(result.removeLabel, REMOVE_LABEL);
    assert.equal(result.items.length, 9);
    assert.deepEqual(result.items.map((item) => item.position), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.equal(result.items[8].videoId, videoId(9));
    assert.deepEqual(progress, [3, 6, 9]);
  });

  it('signs continuation requests the way the web client does', async () => {
    const site = createSite();
    const { collector } = loadWith(site);

    await collector.collect();

    const request = site.requests.find((entry) => entry.url.startsWith('/youtubei/v1/browse'));
    const { headers } = request.init;

    assert.match(headers.Authorization, /^SAPISIDHASH \d+_[0-9a-f]{40} SAPISID1PHASH \d+_[0-9a-f]{40} SAPISID3PHASH \d+_[0-9a-f]{40}$/);
    assert.equal(headers['X-Goog-AuthUser'], '0');
    assert.equal(headers['X-Youtube-Client-Version'], CONFIG.INNERTUBE_CLIENT_VERSION);
    assert.equal(headers['X-Goog-Visitor-Id'], 'visitor-data');
    assert.deepEqual(JSON.parse(request.init.body), { context: CONFIG.INNERTUBE_CONTEXT, continuation: 'token-1' });
  });

  it('treats a continuation page without entries as a failure, not the end', async () => {
    const site = createSite({ breakSecondPage: true });
    const { collector } = loadWith(site);

    await assert.rejects(collector.collect(), (error) => error.code === 'needs-dom');
  });

  it('stops with a clear error when signed out', async () => {
    const site = {
      fetch: async () => new Response(pageHtml({ data: initialData([]), config: { ...CONFIG, LOGGED_IN: false } })),
    };
    const { collector } = loadWith(site);

    await assert.rejects(collector.collect(), (error) => error.code === 'signed-out');
  });

  it('scans another playlist by its ID and reads its title', async () => {
    const requests = [];
    const site = {
      fetch: async (input) => {
        const url = new URL(input, 'https://www.youtube.com');

        requests.push(url.pathname + url.search);

        return new Response(pageHtml({
          data: initialData([lockup({ videoId: videoId(1), listId: 'PLsample1' }), lockup({ videoId: videoId(2), listId: 'WL' })], [], { title: 'Travel videos' }),
          config: CONFIG,
        }));
      },
    };
    const { collector } = loadWith(site);
    const result = plain(await collector.collect({ listId: 'PLsample1' }));

    assert.deepEqual(requests, ['/playlist?list=PLsample1']);
    assert.equal(result.title, 'Travel videos');
    assert.equal(result.listId, 'PLsample1');
    assert.deepEqual(result.items.map((item) => item.videoId), [videoId(1)]);
  });

  it("passes on YouTube's message for a playlist it cannot show", async () => {
    const site = {
      fetch: async () => new Response(pageHtml({ data: initialData([], [], { alert: 'This playlist does not exist.' }), config: CONFIG })),
    };
    const { collector } = loadWith(site);

    await assert.rejects(collector.collect({ listId: 'PLmissing1' }), (error) => error.code === 'empty' && error.message === 'This playlist does not exist.');
  });
});
