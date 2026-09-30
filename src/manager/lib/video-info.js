// Looks up what the page does not show: each video's category, publish date,
// and view count, with the YouTube Data API. It runs only with an API key the
// user supplied.
export const GOOGLE_API_ORIGINS = ['https://www.googleapis.com/*'];

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 50;
const BATCH_DELAY_MIN = 400;
const BATCH_DELAY_MAX = 900;

// Category names come back in this language, for this region's list.
const CATEGORY_LANGUAGE = 'ko';
const CATEGORY_REGION = 'KR';

const API_ERRORS = {
  API_KEY_INVALID: 'API 키가 올바르지 않습니다.',
  keyInvalid: 'API 키가 올바르지 않습니다.',
  quotaExceeded: '오늘 쓸 수 있는 API 할당량을 모두 썼습니다. 내일 다시 시도해 주세요.',
  dailyLimitExceeded: '오늘 쓸 수 있는 API 할당량을 모두 썼습니다. 내일 다시 시도해 주세요.',
  accessNotConfigured: '이 키의 프로젝트에서 YouTube Data API v3가 사용 설정되어 있지 않습니다.',
  SERVICE_DISABLED: '이 키의 프로젝트에서 YouTube Data API v3가 사용 설정되어 있지 않습니다.',
  API_KEY_SERVICE_BLOCKED: '이 API 키로는 YouTube Data API를 쓸 수 없도록 제한되어 있습니다.',
};

const CATEGORY_ID_PATTERN = /^\d{1,4}$/;

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

// The key goes in a header rather than the URL, so it does not end up in
// logs that record request URLs.
const requestApi = async ({ path, params, apiKey, signal }) => {
  const url = new URL(`${API_BASE}/${path}`);

  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const response = await fetch(url, {
    headers: { 'X-Goog-Api-Key': apiKey },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json();
};

const toCount = (value) => {
  const number = Number(value);

  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};

const toTime = (value) => {
  const time = Date.parse(value);

  return Number.isFinite(time) ? time : null;
};

// One stored entry per video. The keys are short because the entries of
// every scanned list share the extension's storage:
// c category ID ('' when the API has no record of the video, such as a
// deleted one), p publish time in ms, v view count, t when it was looked up.
export const readVideoItems = ({ videoIds, body, now }) => {
  const entries = new Map(videoIds.map((videoId) => [videoId, { c: '', p: null, v: null, t: now }]));

  for (const item of body?.items ?? []) {
    if (!entries.has(item.id)) {
      continue;
    }

    const categoryId = item.snippet?.categoryId;

    entries.set(item.id, {
      c: CATEGORY_ID_PATTERN.test(categoryId ?? '') ? categoryId : '',
      p: toTime(item.snippet?.publishedAt),
      v: toCount(item.statistics?.viewCount),
      t: now,
    });
  }

  return [...entries];
};

export const readCategoryItems = (body) => new Map((body?.items ?? [])
  .filter((item) => CATEGORY_ID_PATTERN.test(item.id ?? '') && typeof item.snippet?.title === 'string')
  .map((item) => [item.id, item.snippet.title.trim()]));

export const requestApiPermission = () => chrome.permissions.request({ origins: GOOGLE_API_ORIGINS });

export const removeApiPermission = () => chrome.permissions.remove({ origins: GOOGLE_API_ORIGINS });

// Requests `videos.list` for 50 IDs at a time and reports each batch through
// `onBatch` as [videoId, entry] pairs. Asking for `statistics` as well as
// `snippet` costs nothing extra: the call is one quota unit either way.
export const fetchVideoInfo = async ({ apiKey, videoIds, signal, onBatch }) => {
  for (let start = 0; start < videoIds.length; start += BATCH_SIZE) {
    const batch = videoIds.slice(start, start + BATCH_SIZE);
    const body = await requestApi({
      path: 'videos',
      params: {
        part: 'snippet,statistics',
        id: batch.join(','),
        fields: 'items(id,snippet(categoryId,publishedAt),statistics(viewCount))',
        maxResults: String(BATCH_SIZE),
      },
      apiKey,
      signal,
    });

    onBatch?.(readVideoItems({ videoIds: batch, body, now: Date.now() }), { done: start + batch.length, total: videoIds.length });

    if (start + BATCH_SIZE < videoIds.length) {
      await sleep(BATCH_DELAY_MIN + Math.random() * (BATCH_DELAY_MAX - BATCH_DELAY_MIN), signal);
    }
  }
};

// The names of the categories, such as "음악" or "게임", in one call.
export const fetchCategoryNames = async ({ apiKey, signal }) => readCategoryItems(await requestApi({
  path: 'videoCategories',
  params: { part: 'snippet', regionCode: CATEGORY_REGION, hl: CATEGORY_LANGUAGE, fields: 'items(id,snippet(title))' },
  apiKey,
  signal,
}));
