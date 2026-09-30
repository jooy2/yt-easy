import { toThumbnailUrl } from './snapshot.js';
import { WATCH_LATER_ID, toPlaylistUrl } from './sources.js';
import { readCategoryId, readCategoryName } from './view-model.js';

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
  ['category_id', (item, { info }) => readCategoryId(item, info)],
  ['category_name', (item, { info, names }) => readCategoryText(item, info, names)],
  ['published_at', (item, { info }) => toIsoTime(info.get(item.videoId)?.p)],
  ['view_count', (item, { info }) => info.get(item.videoId)?.v],
  ['info_looked_up_at', (item, { info }) => toIsoTime(info.get(item.videoId)?.t)],
  ['watched_percent', (item) => item.watchedPercent],
  ['url', (item) => toVideoUrl(item.videoId)],
  ['thumbnail', (item) => toThumbnailUrl(item.videoId)],
];

export const toVideoUrl = (videoId) => `https://www.youtube.com/watch?v=${videoId}`;

const toIsoTime = (time) => (time ? new Date(time).toISOString() : '');

// The name only when the category is known, so an export never says "unknown"
// where the column should be empty.
const readCategoryText = (item, info, names) => {
  const categoryId = readCategoryId(item, info);

  return categoryId ? readCategoryName(categoryId, names) : '';
};

export const escapeCsvCell = (value) => {
  let text = value == null ? '' : String(value);

  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

// UTF-8 with a byte order mark, so that spreadsheet apps read Korean titles
// correctly, and CRLF line endings as RFC 4180 describes.
// `info` and `names` are what the Data API told; see `view-model.js`.
export const buildCsv = (items, { info = new Map(), names = new Map() } = {}) => {
  const header = CSV_COLUMNS.map(([name]) => name);
  const rows = items.map((item) => CSV_COLUMNS.map(([, read]) => read(item, { info, names })));

  return `﻿${[header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')}\r\n`;
};

export const buildJson = ({ items, info = new Map(), names = new Map(), kind, exportedAt, listId = WATCH_LATER_ID, listTitle = '' }) => JSON.stringify({
  source: toPlaylistUrl(listId),
  listId,
  listTitle,
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
    categoryId: readCategoryId(item, info) || null,
    categoryName: readCategoryText(item, info, names) || null,
    publishedAt: toIsoTime(info.get(item.videoId)?.p) || null,
    viewCount: info.get(item.videoId)?.v ?? null,
    infoLookedUpAt: toIsoTime(info.get(item.videoId)?.t) || null,
    watchedPercent: item.watchedPercent ?? null,
    url: toVideoUrl(item.videoId),
    thumbnail: toThumbnailUrl(item.videoId),
  })),
}, null, 2);

// A path inside the Downloads folder, such as "yt-easy/wl-export-20260930-141502.csv".
// `prefix` starts with the list's file name part from `toFileSlug`.
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
