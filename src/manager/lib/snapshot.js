// The collected list as it is stored. Everything that arrives from the page
// is checked here before it is kept or shown.
export const SNAPSHOT_VERSION = 1;

const VIDEO_ID_PATTERN = /^[\w-]{11}$/;
const MAX_ITEMS = 10000;
const THUMBNAIL_HOST_PATTERN = /(^|\.)ytimg\.com$/;

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const isThumbnailUrl = (value) => {
  try {
    const url = new URL(value);

    return url.protocol === 'https:' && THUMBNAIL_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
};

export const isVideoId = (value) => typeof value === 'string' && VIDEO_ID_PATTERN.test(value);

export const sanitizeItem = (raw, position) => {
  if (!raw || !isVideoId(raw.videoId)) {
    return null;
  }

  const seconds = raw.durationSeconds;
  const watched = raw.watchedPercent;

  return {
    position,
    videoId: raw.videoId,
    title: clip(raw.title, 500),
    channelName: clip(raw.channelName, 200),
    channelId: clip(raw.channelId, 120),
    durationSeconds: Number.isInteger(seconds) && seconds >= 0 ? seconds : null,
    durationText: clip(raw.durationText, 20),
    thumbnail: isThumbnailUrl(raw.thumbnail) ? raw.thumbnail : `https://i.ytimg.com/vi/${raw.videoId}/mqdefault.jpg`,
    watchedPercent: Number.isInteger(watched) && watched >= 0 && watched <= 100 ? watched : null,
  };
};

// Keeps the list order, drops invalid or repeated entries, and numbers the
// rest from 1.
export const sanitizeItems = (list) => {
  const seen = new Set();
  const items = [];

  for (const raw of Array.isArray(list) ? list.slice(0, MAX_ITEMS) : []) {
    const item = sanitizeItem(raw, items.length + 1);

    if (item && !seen.has(item.videoId)) {
      seen.add(item.videoId);
      items.push(item);
    }
  }

  return items;
};

export const createSnapshot = ({ items, removeLabel, method, collectedAt }) => ({
  version: SNAPSHOT_VERSION,
  collectedAt,
  method: method === 'dom' ? 'dom' : 'data',
  removeLabel: clip(removeLabel, 100) || null,
  items: sanitizeItems(items),
});

export const readSnapshot = (stored) => {
  if (!stored || stored.version !== SNAPSHOT_VERSION || !Array.isArray(stored.items)) {
    return null;
  }

  return createSnapshot(stored);
};

// Drops removed videos and renumbers the rest, the way YouTube renumbers the
// list after a removal.
export const removeFromSnapshot = (snapshot, removedIds) => ({
  ...snapshot,
  items: snapshot.items
    .filter((item) => !removedIds.has(item.videoId))
    .map((item, index) => ({ ...item, position: index + 1 })),
});
