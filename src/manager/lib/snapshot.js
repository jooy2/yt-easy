// A scanned list as it is stored. Everything that arrives from the page is
// checked here before it is kept or shown.
import { WATCH_LATER_ID, WATCH_LATER_TITLE, isListId, isWatchLater } from './sources.js';

// Version 2 added the list ID and title, and stopped storing thumbnail
// addresses, which are built from the video ID instead.
export const SNAPSHOT_VERSION = 2;

const VIDEO_ID_PATTERN = /^[\w-]{11}$/;
const MAX_ITEMS = 10000;

// How many scanned lists are kept, and how many videos they may hold in all,
// so the stored data stays well inside chrome.storage.local's 10 MB.
export const SNAPSHOT_LIMITS = Object.freeze({ lists: 6, items: 20000 });

const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const isVideoId = (value) => typeof value === 'string' && VIDEO_ID_PATTERN.test(value);

export const toThumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

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

export const createSnapshot = ({ listId, title, items, removeLabel, method, collectedAt }) => {
  const id = isListId(listId) ? listId : WATCH_LATER_ID;

  return {
    version: SNAPSHOT_VERSION,
    listId: id,
    title: clip(title, 200) || (isWatchLater(id) ? WATCH_LATER_TITLE : id),
    collectedAt,
    method: method === 'dom' ? 'dom' : 'data',
    removeLabel: clip(removeLabel, 100) || null,
    items: sanitizeItems(items),
  };
};

// Version 1 only ever held Watch later.
export const readSnapshot = (stored) => {
  if (!stored || !Array.isArray(stored.items)) {
    return null;
  }

  if (stored.version === 1) {
    return createSnapshot({ ...stored, listId: WATCH_LATER_ID, title: WATCH_LATER_TITLE });
  }

  return stored.version === SNAPSHOT_VERSION ? createSnapshot(stored) : null;
};

// Drops removed videos and renumbers the rest, the way YouTube renumbers the
// list after a removal.
export const removeFromSnapshot = (snapshot, removedIds) => ({
  ...snapshot,
  items: snapshot.items
    .filter((item) => !removedIds.has(item.videoId))
    .map((item, index) => ({ ...item, position: index + 1 })),
});

// Which lists to keep after a scan: the list just scanned and Watch later
// always stay, then the most recently scanned others while they fit the
// limits. `snapshots` maps list IDs to snapshots.
export const pruneSnapshots = (snapshots, keepId, limits = SNAPSHOT_LIMITS) => {
  const entries = Object.values(snapshots).sort((a, b) => b.collectedAt - a.collectedAt);
  const fixed = entries.filter((entry) => entry.listId === keepId || isWatchLater(entry.listId));
  const kept = [...fixed];
  let items = fixed.reduce((sum, entry) => sum + entry.items.length, 0);

  for (const entry of entries) {
    if (kept.includes(entry)) {
      continue;
    }

    if (kept.length >= limits.lists || items + entry.items.length > limits.items) {
      continue;
    }

    kept.push(entry);
    items += entry.items.length;
  }

  return Object.fromEntries(kept.map((entry) => [entry.listId, entry]));
};
