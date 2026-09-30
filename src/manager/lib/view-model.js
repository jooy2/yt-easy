// Turns the stored list into what the list view shows: filtered, sorted, and
// optionally grouped. Everything here is a pure function of its input.
export const MUSIC_CATEGORY_ID = '10';
export const UNKNOWN_BUCKET_KEY = 'unknown';

export const VIEW_OPTIONS = Object.freeze({
  groupBy: ['none', 'channel', 'duration'],
  sortBy: ['position', 'duration', 'channel'],
  sortDir: ['asc', 'desc'],
  categoryFilter: ['all', 'music', 'other', 'unknown'],
});

export const DEFAULT_VIEW_PREFS = Object.freeze({
  groupBy: 'none',
  sortBy: 'position',
  sortDir: 'asc',
  durationFilter: 'all',
  categoryFilter: 'all',
  filtersOpen: true,
});

const collator = new Intl.Collator('ko', { sensitivity: 'base', numeric: true });

const normalizeText = (text) => String(text ?? '').normalize('NFKC').toLocaleLowerCase('ko');

export const normalizeViewPrefs = (stored) => {
  const input = stored && typeof stored === 'object' ? stored : {};
  const prefs = { ...DEFAULT_VIEW_PREFS };

  for (const [key, allowed] of Object.entries(VIEW_OPTIONS)) {
    if (allowed.includes(input[key])) {
      prefs[key] = input[key];
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
      label: previous === 0 ? `${bound}분 미만` : `${previous}–${bound}분`,
      min: previous * 60,
      max: bound * 60,
    });
    previous = bound;
  }

  buckets.push({ key: `gte-${previous}`, label: `${previous}분 이상`, min: previous * 60, max: Infinity });
  buckets.push({ key: UNKNOWN_BUCKET_KEY, label: '길이 정보 없음', min: null, max: null });

  return buckets;
};

export const findBucket = (buckets, seconds) => {
  if (seconds == null) {
    return buckets.find((bucket) => bucket.key === UNKNOWN_BUCKET_KEY);
  }

  return buckets.find((bucket) => bucket.min != null && seconds >= bucket.min && seconds < bucket.max);
};

export const buildSearchText = (item) => normalizeText(`${item.title}\n${item.channelName}`);

export const matchesCategory = (filter, categoryId) => {
  if (filter === 'music') {
    return categoryId === MUSIC_CATEGORY_ID;
  }

  if (filter === 'other') {
    return typeof categoryId === 'string' && categoryId !== '' && categoryId !== MUSIC_CATEGORY_ID;
  }

  if (filter === 'unknown') {
    return !categoryId;
  }

  return true;
};

export const filterItems = ({ items, searchTexts, query, durationFilter, categoryFilter, categories, buckets }) => {
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

    return matchesCategory(categoryFilter, categories.get(item.videoId));
  });
};

// Sorts a copy. Ties, and videos without a length, keep list order, and
// videos without a length always go last.
export const sortItems = (items, sortBy, sortDir) => {
  const direction = sortDir === 'desc' ? -1 : 1;

  return [...items].sort((a, b) => {
    if (sortBy === 'duration') {
      const aMissing = a.durationSeconds == null;
      const bMissing = b.durationSeconds == null;

      if (aMissing !== bMissing) {
        return aMissing ? 1 : -1;
      }

      const difference = aMissing ? 0 : a.durationSeconds - b.durationSeconds;

      return difference !== 0 ? difference * direction : a.position - b.position;
    }

    if (sortBy === 'channel') {
      const difference = collator.compare(a.channelName, b.channelName);

      return difference !== 0 ? difference * direction : a.position - b.position;
    }

    return (a.position - b.position) * direction;
  });
};

const groupByChannel = ({ items, sortBy, sortDir }) => {
  const groups = new Map();

  for (const item of items) {
    const key = item.channelId || (item.channelName ? `name:${item.channelName}` : 'unknown');

    if (!groups.has(key)) {
      groups.set(key, { key: `channel:${key}`, label: item.channelName || '채널 정보 없음', items: [] });
    }

    groups.get(key).items.push(item);
  }

  const list = [...groups.values()];
  const direction = sortDir === 'desc' ? -1 : 1;

  // Sorted by channel name: groups follow the name. Otherwise the channels
  // with the most videos come first.
  if (sortBy === 'channel') {
    return list.sort((a, b) => collator.compare(a.label, b.label) * direction);
  }

  return list.sort((a, b) => b.items.length - a.items.length || collator.compare(a.label, b.label));
};

const groupByDuration = ({ items, sortBy, sortDir, buckets }) => {
  const groups = new Map(buckets.map((bucket) => [bucket, { key: `duration:${bucket.key}`, label: bucket.label, items: [] }]));

  for (const item of items) {
    groups.get(findBucket(buckets, item.durationSeconds)).items.push(item);
  }

  const list = [...groups.values()].filter((group) => group.items.length > 0);

  if (sortBy === 'duration' && sortDir === 'desc') {
    const unknown = list.filter((group) => group.key === `duration:${UNKNOWN_BUCKET_KEY}`);

    return [...list.filter((group) => !unknown.includes(group)).reverse(), ...unknown];
  }

  return list;
};

export const groupItems = ({ items, groupBy, sortBy, sortDir, buckets }) => {
  if (groupBy === 'channel') {
    return groupByChannel({ items, sortBy, sortDir });
  }

  if (groupBy === 'duration') {
    return groupByDuration({ items, sortBy, sortDir, buckets });
  }

  return [];
};

// Adds the totals the group list shows next to each group.
const describeGroup = (group) => ({
  ...group,
  count: group.items.length,
  totalSeconds: group.items.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0),
});

// `items` is the filtered and sorted list. `groups` splits it by channel or
// length, each group keeping the same order, and is empty without grouping.
export const buildView = (input) => {
  const items = sortItems(filterItems(input), input.sortBy, input.sortDir);
  const groups = input.groupBy === 'none' ? [] : groupItems({ ...input, items }).map(describeGroup);

  return { items, groups };
};
