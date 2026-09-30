(() => {
  const ns = (globalThis.ytEasy ??= {});

  const VIDEO_ID_PATTERN = /^[\w-]{11}$/;
  const DURATION_PATTERN = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/;

  const createAbortError = () => new DOMException('The job was cancelled.', 'AbortError');

  const isAbortError = (error) => error?.name === 'AbortError';

  const isVideoId = (value) => typeof value === 'string' && VIDEO_ID_PATTERN.test(value);

  // Resolves after `ms`, or rejects as soon as `signal` aborts.
  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });

  const randomBetween = (min, max) => min + Math.random() * Math.max(0, max - min);

  // Polls `check` until it returns a truthy value, and returns that value.
  // Returns null when `timeout` passes first.
  const waitFor = async (check, { timeout = 5000, interval = 100, signal } = {}) => {
    const deadline = Date.now() + timeout;

    while (true) {
      const value = check();

      if (value) {
        return value;
      }

      if (Date.now() >= deadline) {
        return null;
      }

      await sleep(interval, signal);
    }
  };

  const textOf = (element) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

  // "1:02:03" -> 3723, "4:05" -> 245. Anything else, such as a live badge,
  // returns null.
  const parseDurationText = (text) => {
    const match = DURATION_PATTERN.exec(String(text ?? '').trim());

    if (!match) {
      return null;
    }

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);

    return hours * 3600 + minutes * 60 + seconds;
  };

  ns.util = {
    createAbortError,
    isAbortError,
    isVideoId,
    sleep,
    randomBetween,
    waitFor,
    textOf,
    parseDurationText,
  };
})();
