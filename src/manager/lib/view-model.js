// Turns the stored list into what the list view shows: filtered, sorted, and
// optionally grouped. Everything here is a pure function of its input.
//
// `info` maps video IDs to what the Data API told about them: { c: category
// ID, p: publish time, v: view count, t: when it was looked up }. `names`
// maps category IDs to their names.
import { locale, t } from '../../i18n/runtime.js';

export const MUSIC_CATEGORY_ID = '10';
export const UNKNOWN_BUCKET_KEY = 'unknown';

// Special values of the category filter. Any other value is a category ID.
export const CATEGORY_FILTER_ALL = 'all';
export const CATEGORY_FILTER_NOT_MUSIC = 'other';
export const CATEGORY_FILTER_UNKNOWN = 'unknown';

// A video counts as watched from this share of its length. YouTube keeps the
// red bar short of full when the end credits were skipped.
export const WATCHED_PERCENT = 90;

// Sorts that need what only the Data API knows.
export const INFO_SORTS = Object.freeze(['published', 'views', 'category']);

export const VIEW_OPTIONS = Object.freeze({
  sortBy: ['position', 'published', 'views', 'channel', 'duration', 'category'],
  groupOrder: ['name', 'count'],
  sortDir: ['asc', 'desc'],
  watchFilter: ['all', 'unwatched', 'partial', 'watched'],
});

export const DEFAULT_VIEW_PREFS = Object.freeze({
  sortBy: 'position',
  sortDir: 'asc',
  groupOrder: 'name',
  durationFilter: 'all',
  categoryFilter: CATEGORY_FILTER_ALL,
  watchFilter: 'all',
  filtersOpen: true,
});

const CATEGORY_ID_PATTERN = /^\d{1,4}$/;

// Sorting by channel name, length, or category also splits the list into
// channels, length ranges, or categories, which the manager lists beside the
// videos.
export const readGrouping = (sortBy) => {
  if (sortBy === 'channel' || sortBy === 'duration' || sortBy === 'category') {
    return sortBy;
  }

  return 'none';
};

const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });

const normalizeText = (text) => String(text ?? '').normalize('NFKC').toLocaleLowerCase(locale);

const readCategoryFilter = (value) => {
  // Before other categories could be chosen, music was 'music'.
  if (value === 'music') {
    return MUSIC_CATEGORY_ID;
  }

  if ([CATEGORY_FILTER_ALL, CATEGORY_FILTER_NOT_MUSIC, CATEGORY_FILTER_UNKNOWN].includes(value) || CATEGORY_ID_PATTERN.test(value ?? '')) {
    return value;
  }

  return CATEGORY_FILTER_ALL;
};

export const normalizeViewPrefs = (stored) => {
  const input = stored && typeof stored === 'object' ? stored : {};
  // The group order used to apply to channels only, as `channelOrder`.
  const source = { groupOrder: input.channelOrder, ...input };
  const prefs = { ...DEFAULT_VIEW_PREFS };

  for (const [key, allowed] of Object.entries(VIEW_OPTIONS)) {
    if (allowed.includes(source[key])) {
      prefs[key] = source[key];
    }
  }

  // Bucket keys depend on the settings, so they are checked against the
  // buckets later.
  if (typeof input.durationFilter === 'string') {
    prefs.durationFilter = input.durationFilter;
  }

  if (typeof input.filtersOpen === 'boolean') {
    prefs.filtersOpen = input.filtersOpen;
  }

  prefs.categoryFilter = readCategoryFilter(input.categoryFilter);

  return prefs;
};

// [5, 20, 60] -> under 5 min, 5-20 min, 20-60 min, 60 min and over, and a
// last bucket for videos without a known length.
export const createBuckets = (bounds) => {
  const buckets = [];
  let previous = 0;

  for (const bound of bounds) {
    buckets.push({
      key: previous === 0 ? `lt-${bound}` : `${previous}-${bound}`,
      label: previous === 0 ? t('duration.under', { max: bound }) : t('duration.range', { min: previous, max: bound }),
      min: previous * 60,
      max: bound * 60,
    });
    previous = bound;
  }

  buckets.push({ key: `gte-${previous}`, label: t('duration.over', { min: previous }), min: previous * 60, max: Infinity });
  buckets.push({ key: UNKNOWN_BUCKET_KEY, label: t('duration.unknown'), min: null, max: null });

  return buckets;
};

export const findBucket = (buckets, seconds) => {
  if (seconds == null) {
    return buckets.find((bucket) => bucket.key === UNKNOWN_BUCKET_KEY);
  }

  return buckets.find((bucket) => bucket.min != null && seconds >= bucket.min && seconds < bucket.max);
};

export const buildSearchText = (item) => normalizeText(`${item.title}\n${item.channelName}`);

// '' until the Data API has looked the video up, and for a video it has no
// record of.
export const readCategoryId = (item, info) => info.get(item.videoId)?.c ?? '';

export const readCategoryName = (categoryId, names) => {
  if (!categoryId) {
    return t('category.unknown');
  }

  return names.get(categoryId) ?? t('category.fallback', { id: categoryId });
};

// Only the Data API knows a video's category, so a video it has not looked
// up counts as not music.
export const isMusicVideo = (item, info) => readCategoryId(item, info) === MUSIC_CATEGORY_ID;

// 'all' keeps everything, 'other' everything not known to be music,
// 'unknown' the videos without a category, and a category ID that category.
export const matchesCategory = (filter, item, info) => {
  if (filter === CATEGORY_FILTER_ALL) {
    return true;
  }

  if (filter === CATEGORY_FILTER_NOT_MUSIC) {
    return !isMusicVideo(item, info);
  }

  if (filter === CATEGORY_FILTER_UNKNOWN) {
    return !readCategoryId(item, info);
  }

  return readCategoryId(item, info) === filter;
};

// `percent` is null for a video without a red bar.
export const matchesWatch = (filter, percent) => {
  const watched = percent ?? 0;

  if (filter === 'unwatched') {
    return watched === 0;
  }

  if (filter === 'partial') {
    return watched > 0 && watched < WATCHED_PERCENT;
  }

  if (filter === 'watched') {
    return watched >= WATCHED_PERCENT;
  }

  return true;
};

export const filterItems = ({
  items,
  searchTexts,
  query,
  durationFilter,
  categoryFilter = CATEGORY_FILTER_ALL,
  watchFilter = 'all',
  info = new Map(),
  buckets,
}) => {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  const bucket = durationFilter === 'all' ? null : buckets.find((entry) => entry.key === durationFilter);

  return items.filter((item) => {
    if (terms.length > 0) {
      const text = searchTexts.get(item.videoId) ?? buildSearchText(item);

      if (!terms.every((term) => text.includes(term))) {
        return false;
      }
    }

    if (bucket && findBucket(buckets, item.durationSeconds) !== bucket) {
      return false;
    }

    if (!matchesWatch(watchFilter, item.watchedPercent)) {
      return false;
    }

    return matchesCategory(categoryFilter, item, info);
  });
};

// Compares two values that may be missing: missing ones always go last,
// whichever the direction.
const compareMissingLast = (a, b, direction) => {
  const aMissing = a == null || a === '';
  const bMissing = b == null || b === '';

  if (aMissing || bMissing) {
    return aMissing === bMissing ? 0 : (aMissing ? 1 : -1);
  }

  const difference = typeof a === 'string' ? collator.compare(a, b) : a - b;

  return difference * direction;
};

// Sorts a copy. Ties keep list order, and videos without the sorted value,
// such as an unknown length or a video the Data API has not looked up, go
// last.
export const sortItems = (items, sortBy, sortDir, { info = new Map(), names = new Map() } = {}) => {
  const direction = sortDir === 'desc' ? -1 : 1;
  const readers = {
    duration: (item) => item.durationSeconds,
    channel: (item) => item.channelName,
    published: (item) => info.get(item.videoId)?.p,
    views: (item) => info.get(item.videoId)?.v,
    category: (item) => {
      const categoryId = readCategoryId(item, info);

      return categoryId ? readCategoryName(categoryId, names) : null;
    },
  };
  const read = readers[sortBy];

  return [...items].sort((a, b) => {
    if (!read) {
      return (a.position - b.position) * direction;
    }

    return compareMissingLast(read(a), read(b), direction) || a.position - b.position;
  });
};

// Groups in name order, following the sort direction, or with the most
// videos first. The group of videos without a value stays last.
const orderGroups = ({ list, sortDir, groupOrder, lastKey }) => {
  const direction = sortDir === 'desc' ? -1 : 1;
  const last = list.filter((group) => group.key === lastKey);
  const rest = list.filter((group) => group.key !== lastKey);

  if (groupOrder === 'count') {
    rest.sort((a, b) => b.items.length - a.items.length || collator.compare(a.label, b.label));
  } else {
    rest.sort((a, b) => collator.compare(a.label, b.label) * direction);
  }

  return [...rest, ...last];
};

const groupByChannel = ({ items, sortDir, groupOrder }) => {
  const groups = new Map();

  for (const item of items) {
    const key = item.channelId || (item.channelName ? `name:${item.channelName}` : 'unknown');

    if (!groups.has(key)) {
      groups.set(key, { key: `channel:${key}`, label: item.channelName || t('common.no-channel'), items: [] });
    }

    groups.get(key).items.push(item);
  }

  return orderGroups({ list: [...groups.values()], sortDir, groupOrder, lastKey: 'channel:unknown' });
};

const groupByCategory = ({ items, sortDir, groupOrder, info, names }) => {
  const groups = new Map();

  for (const item of items) {
    const categoryId = readCategoryId(item, info);
    const key = categoryId || UNKNOWN_BUCKET_KEY;

    if (!groups.has(key)) {
      groups.set(key, { key: `category:${key}`, label: readCategoryName(categoryId, names), items: [] });
    }

    groups.get(key).items.push(item);
  }

  return orderGroups({ list: [...groups.values()], sortDir, groupOrder, lastKey: `category:${UNKNOWN_BUCKET_KEY}` });
};

// Length ranges in order, reversed for a descending sort. Videos without a
// known length stay last either way.
const groupByDuration = ({ items, sortDir, buckets }) => {
  const groups = new Map(buckets.map((bucket) => [bucket, { key: `duration:${bucket.key}`, label: bucket.label, items: [] }]));

  for (const item of items) {
    groups.get(findBucket(buckets, item.durationSeconds)).items.push(item);
  }

  const list = [...groups.values()].filter((group) => group.items.length > 0);

  if (sortDir === 'desc') {
    const unknown = list.filter((group) => group.key === `duration:${UNKNOWN_BUCKET_KEY}`);

    return [...list.filter((group) => !unknown.includes(group)).reverse(), ...unknown];
  }

  return list;
};

export const groupItems = ({ items, sortBy, sortDir, groupOrder, buckets, info = new Map(), names = new Map() }) => {
  const grouping = readGrouping(sortBy);

  if (grouping === 'channel') {
    return groupByChannel({ items, sortDir, groupOrder });
  }

  if (grouping === 'duration') {
    return groupByDuration({ items, sortDir, buckets });
  }

  if (grouping === 'category') {
    return groupByCategory({ items, sortDir, groupOrder, info, names });
  }

  return [];
};

// Adds the totals the group list shows next to each group.
const describeGroup = (group) => ({
  ...group,
  count: group.items.length,
  totalSeconds: group.items.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0),
});

// `items` is the filtered and sorted list. `groups` splits it by channel,
// length, or category when the sort calls for it, each group keeping the
// same order, and is empty otherwise.
export const buildView = (input) => {
  const items = sortItems(filterItems(input), input.sortBy, input.sortDir, input);
  const groups = groupItems({ ...input, items }).map(describeGroup);

  return { items, groups };
};

// The categories present in `items`, by name, for the category filter.
export const listCategories = (items, info, names) => {
  const ids = new Set();

  for (const item of items) {
    const categoryId = readCategoryId(item, info);

    if (categoryId) {
      ids.add(categoryId);
    }
  }

  return [...ids]
    .map((categoryId) => ({ categoryId, name: readCategoryName(categoryId, names) }))
    .sort((a, b) => collator.compare(a.name, b.name));
};
