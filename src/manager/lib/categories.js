// Looks up each video's category with the YouTube Data API. The page does not
// show categories, so this is the only way to tell music videos apart. It
// runs only with an API key the user supplied.
export const GOOGLE_API_ORIGINS = ['https://www.googleapis.com/*'];

const ENDPOINT = 'https://www.googleapis.com/youtube/v3/videos';
const BATCH_SIZE = 50;
const BATCH_DELAY_MIN = 400;
const BATCH_DELAY_MAX = 900;

const API_ERRORS = {
  API_KEY_INVALID: 'API 키가 올바르지 않습니다.',
  keyInvalid: 'API 키가 올바르지 않습니다.',
  quotaExceeded: '오늘 쓸 수 있는 API 할당량을 모두 썼습니다. 내일 다시 시도해 주세요.',
  dailyLimitExceeded: '오늘 쓸 수 있는 API 할당량을 모두 썼습니다. 내일 다시 시도해 주세요.',
  accessNotConfigured: '이 키의 프로젝트에서 YouTube Data API v3가 사용 설정되어 있지 않습니다.',
  SERVICE_DISABLED: '이 키의 프로젝트에서 YouTube Data API v3가 사용 설정되어 있지 않습니다.',
  API_KEY_SERVICE_BLOCKED: '이 API 키로는 YouTube Data API를 쓸 수 없도록 제한되어 있습니다.',
};

const createAbortError = () => new DOMException('The job was cancelled.', 'AbortError');

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(createAbortError());
    return;
  }

  const timer = setTimeout(resolve, ms);

  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(createAbortError());
  }, { once: true });
});

// Reads the reason from an error response. The key itself never appears in
// the message.
const readApiError = async (response) => {
  try {
    const body = await response.json();
    const reasons = [
      ...(body.error?.errors ?? []).map((error) => error.reason),
      ...(body.error?.details ?? []).map((detail) => detail.reason),
    ];
    const known = reasons.find((reason) => API_ERRORS[reason]);

    if (known) {
      return API_ERRORS[known];
    }
  } catch {
    // Not JSON; fall through to the status code.
  }

  return `YouTube Data API 요청이 실패했습니다 (HTTP ${response.status}).`;
};

export const requestApiPermission = () => chrome.permissions.request({ origins: GOOGLE_API_ORIGINS });

export const removeApiPermission = () => chrome.permissions.remove({ origins: GOOGLE_API_ORIGINS });

// Requests `videos.list` for 50 IDs at a time and reports each batch through
// `onBatch` as [videoId, categoryId] pairs. A video the API has no record of
// (deleted or private) gets ''.
export const fetchCategories = async ({ apiKey, videoIds, signal, onBatch }) => {
  for (let start = 0; start < videoIds.length; start += BATCH_SIZE) {
    const batch = videoIds.slice(start, start + BATCH_SIZE);
    const url = new URL(ENDPOINT);

    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('fields', 'items(id,snippet(categoryId))');
    url.searchParams.set('maxResults', String(BATCH_SIZE));

    // The key goes in a header rather than the URL, so it does not end up in
    // logs that record request URLs.
    const response = await fetch(url, {
      headers: { 'X-Goog-Api-Key': apiKey },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    const body = await response.json();
    const found = new Map(batch.map((id) => [id, '']));

    for (const item of body.items ?? []) {
      if (found.has(item.id) && typeof item.snippet?.categoryId === 'string') {
        found.set(item.id, item.snippet.categoryId);
      }
    }

    onBatch?.([...found], { done: start + batch.length, total: videoIds.length });

    if (start + BATCH_SIZE < videoIds.length) {
      await sleep(BATCH_DELAY_MIN + Math.random() * (BATCH_DELAY_MAX - BATCH_DELAY_MIN), signal);
    }
  }
};
