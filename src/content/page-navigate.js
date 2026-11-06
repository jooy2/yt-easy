// The one script that runs in the page's own world rather than the
// extension's, since only there can it reach YouTube's app. It waits for
// `navigation.js` to ask for a move to another video, and passes the request
// on to the element it names. The request is JSON text, which crosses
// between the two worlds where an object would not.
(() => {
  const REQUEST_EVENT = 'yt-easy-navigate';

  document.addEventListener(REQUEST_EVENT, (event) => {
    let request = null;

    try {
      request = JSON.parse(event.detail);
    } catch {
      return;
    }

    if (typeof request?.appSelector !== 'string' || typeof request.eventName !== 'string') {
      return;
    }

    document.querySelector(request.appSelector)?.dispatchEvent(new CustomEvent(request.eventName, {
      bubbles: true,
      composed: true,
      detail: request.detail,
    }));
  });
})();
