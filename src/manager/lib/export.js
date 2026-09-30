export const WATCH_LATER_URL = 'https://www.youtube.com/playlist?list=WL';

const DOWNLOAD_FOLDER = 'yt-easy';
const DOWNLOAD_TIMEOUT = 120000;

// Spreadsheet apps run a cell that starts with one of these as a formula.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

const CSV_COLUMNS = [
  ['position', (item) => item.position],
  ['video_id', (item) => item.videoId],
  ['title', (item) => item.title],
  ['channel_name', (item) => item.channelName],
  ['channel_id', (item) => item.channelId],
  ['duration_seconds', (item) => item.durationSeconds],
  ['duration', (item) => item.durationText],
  ['category_id', (item, categories) => categories.get(item.videoId)],
  ['watched_percent', (item) => item.watchedPercent],
  ['url', (item) => toVideoUrl(item.videoId)],
  ['thumbnail', (item) => item.thumbnail],
];

export const toVideoUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

export const escapeCsvCell = (value) => {
  let text = value == null ? '' : String(value);

  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

// UTF-8 with a byte order mark, so that spreadsheet apps read Korean titles
// correctly, and CRLF line endings as RFC 4180 describes.
export const buildCsv = (items, categories = new Map()) => {
  const header = CSV_COLUMNS.map(([name]) => name);
  const rows = items.map((item) => CSV_COLUMNS.map(([, read]) => read(item, categories)));

  return `﻿${[header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
};

export const buildJson = ({ items, categories = new Map(), kind, exportedAt }) => JSON.stringify({
  source: WATCH_LATER_URL,
  kind,
  exportedAt: new Date(exportedAt).toISOString(),
  count: items.length,
  items: items.map((item) => ({
    position: item.position,
    videoId: item.videoId,
    title: item.title,
    channelName: item.channelName,
    channelId: item.channelId,
    durationSeconds: item.durationSeconds,
    durationText: item.durationText,
    categoryId: categories.get(item.videoId) ?? null,
    watchedPercent: item.watchedPercent ?? null,
    url: toVideoUrl(item.videoId),
    thumbnail: item.thumbnail,
  })),
}, null, 2);

// A path inside the Downloads folder, such as "yt-easy/wl-export-20260930-141502.csv".
export const buildFileName = ({ prefix, stamp, extension }) => `${DOWNLOAD_FOLDER}/${prefix}-${stamp}.${extension}`;

// Saves text through the downloads API and resolves once the file is
// complete on disk, so a backup is known to exist before anything is removed.
export const downloadText = ({ filename, text, type }) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  let downloadId = null;
  let settled = false;

  const settle = (error) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timer);
    chrome.downloads.onChanged.removeListener(onChanged);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    if (error) {
      reject(error);
    } else {
      resolve(downloadId);
    }
  };

  const checkState = (state) => {
    if (state === 'complete') {
      settle();
    } else if (state === 'interrupted') {
      settle(new Error(`${filename} 파일을 저장하지 못했습니다.`));
    }
  };

  const onChanged = (delta) => {
    if (delta.id === downloadId && delta.state) {
      checkState(delta.state.current);
    }
  };

  const timer = setTimeout(() => settle(new Error(`${filename} 파일 저장이 끝나지 않았습니다.`)), DOWNLOAD_TIMEOUT);

  chrome.downloads.onChanged.addListener(onChanged);
  chrome.downloads.download({ url, filename, conflictAction: 'uniquify', saveAs: false })
    .then(async (id) => {
      downloadId = id;

      // The download may have finished before its ID arrived.
      const [item] = await chrome.downloads.search({ id });

      checkState(item?.state);
    })
    .catch((error) => settle(new Error(`${filename} 파일을 저장하지 못했습니다. ${error.message}`)));
});
