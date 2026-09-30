// Looks up what the page does not show: each video's category, publish date,
// and view count, with the YouTube Data API. It runs only with an API key the
// user supplied.
import { locale, t } from '../../i18n/runtime.js';

export const GOOGLE_API_ORIGINS = ['https://www.googleapis.com/*'];

// The YouTube API Services policies ask an app that uses them to link to
// these two pages where the user turns the feature on.
export const YOUTUBE_TERMS_URL = 'https://www.youtube.com/t/terms';
export const GOOGLE_PRIVACY_URL = 'https://www.google.com/policies/privacy';

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const BATCH_SIZE = 50;
const BATCH_DELAY_MIN = 400;
const BATCH_DELAY_MAX = 900;

// Category names come back in the manager's language, from the list of the
// region that speaks it.
const CATEGORY_REGIONS = { en: 'US', ko: 'KR' };

// Message keys for the reasons the API gives.
const API_ERRORS = {
  API_KEY_INVALID: 'info.error-key',
  keyInvalid: 'info.error-key',
  quotaExceeded: 'info.error-quota',
  dailyLimitExceeded: 'info.error-quota',
  accessNotConfigured: 'info.error-disabled',
  SERVICE_DISABLED: 'info.error-disabled',
  API_KEY_SERVICE_BLOCKED: 'info.error-blocked',
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
      return t(API_ERRORS[known]);
    }
  } catch {
    // Not JSON; fall through to the status code.
  }

  return t('info.error-http', { status: String(response.status) });
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

// The category names come in the manager's language, so they are asked for
// again when that changes, as after Chrome's language changed. Earlier
// versions kept no language with the names and always asked in Korean.
const LEGACY_NAMES_LOCALE = 'ko';

export const readNamesLocale = (stored) => (typeof stored === 'string' && /^[a-z]{2,3}$/.test(stored) ? stored : LEGACY_NAMES_LOCALE);

export const needsCategoryNames = ({ names, namesLocale, currentLocale = locale }) => names.size === 0 || namesLocale !== currentLocale;

export const requestApiPermission = () => chrome.permissions.request({ origins: GOOGLE_API_ORIGINS });

// Checks the access without asking for it, so it works outside a click.
export const hasApiPermission = () => chrome.permissions.contains({ origins: GOOGLE_API_ORIGINS });

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

// The names of the categories, such as "Music" or "Gaming", in one call.
export const fetchCategoryNames = async ({ apiKey, signal }) => readCategoryItems(await requestApi({
  path: 'videoCategories',
  params: { part: 'snippet', regionCode: CATEGORY_REGIONS[locale] ?? 'US', hl: locale, fields: 'items(id,snippet(title))' },
  apiKey,
  signal,
}));
