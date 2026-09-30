const NUMBER_FORMAT = new Intl.NumberFormat('ko-KR');
const DATE_TIME_FORMAT = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

const pad = (value) => String(value).padStart(2, '0');

export const formatCount = (value) => NUMBER_FORMAT.format(value);

export const formatDateTime = (timestamp) => DATE_TIME_FORMAT.format(new Date(timestamp));

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

// A total for a group heading: "3시간 20분", "45분", "30초".
export const formatTotalDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0분';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    const text = `${NUMBER_FORMAT.format(hours)}시간`;

    return minutes > 0 ? `${text} ${minutes}분` : text;
  }

  return minutes > 0 ? `${minutes}분` : `${Math.floor(seconds)}초`;
};

// Local time as "20260930-141502", for file names.
export const formatFileStamp = (date) => [
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
  `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
].join('-');
