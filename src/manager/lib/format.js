import { locale, t } from '../../i18n/runtime.js';

const NUMBER_FORMAT = new Intl.NumberFormat(locale);
const DATE_FORMAT = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
const DATE_TIME_FORMAT = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
// Truncated rather than rounded, as YouTube writes view counts: 1,290,000
// is "1.2M", never "1.3M".
const COMPACT_FORMAT = new Intl.NumberFormat(locale, { notation: 'compact', roundingMode: 'trunc' });

const pad = (value) => String(value).padStart(2, '0');

export const formatCount = (value) => NUMBER_FORMAT.format(value);

export const formatDateTime = (timestamp) => DATE_TIME_FORMAT.format(new Date(timestamp));

export const formatDate = (timestamp) => DATE_FORMAT.format(new Date(timestamp));

// A view count the way YouTube writes it: "950 views", "3.2K views",
// "1.2M views", or "조회수 3.2만회" in Korean.
export const formatViews = (count) => t('format.views', { count, views: COMPACT_FORMAT.format(count) });

// 245 -> "4:05", 3723 -> "1:02:03". Unknown durations return ''.
export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
};

// A total for a group heading: "3 hr 20 min", "45 min", "30 sec".
export const formatTotalDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return t('format.minutes', { minutes: 0 });
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? t('format.hours-minutes', { hours, minutes }) : t('format.hours', { hours });
  }

  return minutes > 0 ? t('format.minutes', { minutes }) : t('format.seconds', { seconds: Math.floor(seconds) });
};

// Local time as "20260930-141502", for file names.
export const formatFileStamp = (date) => [
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
  `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
].join('-');
