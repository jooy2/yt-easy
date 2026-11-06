// Opens a video in this tab without loading the whole page again, the way a
// click on a video link inside YouTube does. The request goes through
// `page-navigate.js`, which runs in the page's world.
(() => {
  const ns = (globalThis.ytEasy ??= {});
  const { NAVIGATION, util } = ns;

  // Shared with `page-navigate.js`.
  const REQUEST_EVENT = 'yt-easy-navigate';
  // YouTube changes the address at once when it takes the request, so a
  // short wait tells a move that started from one that never will.
  const CONFIRM_TIMEOUT = 2000;

  const isOnVideo = (videoId) => location.pathname === '/watch' && new URLSearchParams(location.search).get('v') === videoId;

  // Resolves to true once the tab shows the video, or false when YouTube did
  // not take the request; the manager then loads the address instead.
  const openVideo = async (videoId) => {
    if (!util.isVideoId(videoId)) {
      return false;
    }

    document.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
      detail: JSON.stringify({
        appSelector: NAVIGATION.appSelector,
        eventName: NAVIGATION.eventName,
        detail: { endpoint: NAVIGATION.buildWatchEndpoint(videoId) },
      }),
    }));

    return Boolean(await util.waitFor(() => isOnVideo(videoId), { timeout: CONFIRM_TIMEOUT, interval: 50 }));
  };

  ns.navigation = { openVideo };
})();
