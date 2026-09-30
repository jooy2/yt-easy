import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSearchText,
  buildView,
  createBuckets,
  findBucket,
  matchesCategory,
  isMusicVideo,
  listCategories,
  sortItems as sortWithInfo,
  normalizeViewPrefs,
  sortItems,
} from '../src/manager/lib/view-model.js';

const item = (position, fields = {}) => ({
  position,
  videoId: `vid${String(position).padStart(8, '0')}`,
  title: `Video ${position}`,
  channelName: 'Channel',
  channelId: 'UCchannel',
  durationSeconds: 60,
  durationText: '1:00',
  thumbnail: '',
  ...fields,
});

const ITEMS = [
  item(1, { title: '피아노 연주 모음', channelName: '가나다 채널', channelId: 'UCa', durationSeconds: 3900 }),
  item(2, { title: 'Quick tip', channelName: 'Zeta', channelId: 'UCz', durationSeconds: 90 }),
  item(3, { title: 'Live now', channelName: '가나다 채널', channelId: 'UCa', durationSeconds: null, durationText: 'LIVE' }),
  item(4, { title: 'Lecture', channelName: 'Alpha', channelId: 'UCb', durationSeconds: 1500 }),
  item(5, { title: 'Song', channelName: 'Zeta', channelId: 'UCz', durationSeconds: 300 }),
];

const baseInput = (overrides = {}) => ({
  items: ITEMS,
  searchTexts: new Map(ITEMS.map((entry) => [entry.videoId, buildSearchText(entry)])),
  query: '',
  durationFilter: 'all',
  categoryFilter: 'all',
  info: new Map(),
  names: new Map(),
  buckets: createBuckets([5, 20, 60]),
  sortBy: 'position',
  sortDir: 'asc',
  ...overrides,
});

const positions = (items) => items.map((entry) => entry.position);

describe('duration buckets', () => {
  const buckets = createBuckets([5, 20, 60]);

  it('builds labelled ranges from the bounds', () => {
    assert.deepEqual(buckets.map((bucket) => bucket.label), ['Under 5 min', '5–20 min', '20–60 min', '60 min and over', 'Unknown length']);
  });

  it('puts a bound into the range that starts at it', () => {
    assert.equal(findBucket(buckets, 0).key, 'lt-5');
    assert.equal(findBucket(buckets, 299).key, 'lt-5');
    assert.equal(findBucket(buckets, 300).key, '5-20');
    assert.equal(findBucket(buckets, 3599).key, '20-60');
    assert.equal(findBucket(buckets, 3600).key, 'gte-60');
    assert.equal(findBucket(buckets, null).key, 'unknown');
  });
});

describe('sortItems', () => {
  it('sorts by length and keeps unknown lengths last in both directions', () => {
    assert.deepEqual(positions(sortItems(ITEMS, 'duration', 'asc')), [2, 5, 4, 1, 3]);
    assert.deepEqual(positions(sortItems(ITEMS, 'duration', 'desc')), [1, 4, 5, 2, 3]);
  });

  it('sorts by channel name, Latin names before Hangul in English, and breaks ties by list order', () => {
    assert.deepEqual(positions(sortItems(ITEMS, 'channel', 'asc')), [4, 2, 5, 1, 3]);
  });

  it('reverses list order', () => {
    assert.deepEqual(positions(sortItems(ITEMS, 'position', 'desc')), [5, 4, 3, 2, 1]);
  });
});

describe('buildView', () => {
  it('matches every search term against title and channel, ignoring case', () => {
    assert.deepEqual(positions(buildView(baseInput({ query: '가나다 LIVE' })).items), [3]);
    assert.deepEqual(positions(buildView(baseInput({ query: 'zeta' })).items), [2, 5]);
  });

  it('filters by duration bucket', () => {
    assert.deepEqual(positions(buildView(baseInput({ durationFilter: '20-60' })).items), [4]);
    assert.deepEqual(positions(buildView(baseInput({ durationFilter: 'unknown' })).items), [3]);
  });

  it('filters by how much was watched', () => {
    const watched = ITEMS.map((entry, index) => ({ ...entry, watchedPercent: [null, 0, 40, 90, 100][index] }));
    const input = (watchFilter) => baseInput({ items: watched, searchTexts: new Map(), watchFilter });

    assert.deepEqual(positions(buildView(input('unwatched')).items), [1, 2]);
    assert.deepEqual(positions(buildView(input('partial')).items), [3]);
    assert.deepEqual(positions(buildView(input('watched')).items), [4, 5]);
    assert.deepEqual(positions(buildView(input('all')).items), [1, 2, 3, 4, 5]);
  });

  it('filters by any category, by not music, and by unknown', () => {
    const info = new Map([[ITEMS[0].videoId, { c: '10' }], [ITEMS[1].videoId, { c: '27' }], [ITEMS[2].videoId, { c: '' }], [ITEMS[3].videoId, { c: '27' }]]);

    assert.deepEqual(positions(buildView(baseInput({ info, categoryFilter: '10' })).items), [1]);
    assert.deepEqual(positions(buildView(baseInput({ info, categoryFilter: '27' })).items), [2, 4]);
    assert.deepEqual(positions(buildView(baseInput({ info, categoryFilter: 'other' })).items), [2, 3, 4, 5]);
    assert.deepEqual(positions(buildView(baseInput({ info, categoryFilter: 'unknown' })).items), [3, 5]);
  });

  it('sorts by publish date and by views, with videos not looked up last', () => {
    const info = new Map([
      [ITEMS[0].videoId, { c: '10', p: 300, v: 5 }],
      [ITEMS[1].videoId, { c: '27', p: 100, v: 900 }],
      [ITEMS[3].videoId, { c: '27', p: 200, v: null }],
    ]);

    assert.deepEqual(positions(sortWithInfo(ITEMS, 'published', 'asc', { info })), [2, 4, 1, 3, 5]);
    assert.deepEqual(positions(sortWithInfo(ITEMS, 'published', 'desc', { info })), [1, 4, 2, 3, 5]);
    assert.deepEqual(positions(sortWithInfo(ITEMS, 'views', 'desc', { info })), [2, 1, 3, 4, 5]);
  });

  it('groups by category name, with unknown last, when sorting by category', () => {
    const info = new Map([[ITEMS[0].videoId, { c: '10' }], [ITEMS[1].videoId, { c: '27' }], [ITEMS[3].videoId, { c: '27' }]]);
    const names = new Map([['10', 'Music'], ['27', 'Education']]);
    const byName = buildView(baseInput({ info, names, sortBy: 'category' })).groups;
    const byCount = buildView(baseInput({ info, names, sortBy: 'category', groupOrder: 'count' })).groups;

    assert.deepEqual(byName.map((group) => [group.label, positions(group.items)]), [['Education', [2, 4]], ['Music', [1]], ['Unknown category', [3, 5]]]);
    assert.deepEqual(byCount.map((group) => group.label), ['Education', 'Music', 'Unknown category']);
  });

  it('lists the categories found, by name, for the filter', () => {
    const info = new Map([[ITEMS[0].videoId, { c: '10' }], [ITEMS[1].videoId, { c: '20' }]]);

    assert.deepEqual(listCategories(ITEMS, info, new Map([['10', 'Music']])), [
      { categoryId: '20', name: 'Category 20' },
      { categoryId: '10', name: 'Music' },
    ]);
  });

  it('lists channels by name when sorting by channel, following the direction', () => {
    const { groups } = buildView(baseInput({ sortBy: 'channel', sortDir: 'desc' }));

    assert.deepEqual(groups.map((group) => group.label), ['가나다 채널', 'Zeta', 'Alpha']);
    assert.deepEqual(positions(groups[1].items), [2, 5]);
  });

  it('lists the channels with the most videos first when asked', () => {
    const { groups } = buildView(baseInput({ sortBy: 'channel', groupOrder: 'count' }));

    assert.deepEqual(groups.map((group) => [group.label, group.count]), [['Zeta', 2], ['가나다 채널', 2], ['Alpha', 1]]);
    assert.equal(groups[0].totalSeconds, 390);
  });

  it('splits by length range when sorting by length, and sorts inside each range', () => {
    const items = [...ITEMS, item(6, { durationSeconds: 200 })];
    const { groups } = buildView(baseInput({ items, searchTexts: new Map(), sortBy: 'duration' }));

    assert.deepEqual(groups.map((group) => [group.label, positions(group.items)]), [
      ['Under 5 min', [2, 6]],
      ['5–20 min', [5]],
      ['20–60 min', [4]],
      ['60 min and over', [1]],
      ['Unknown length', [3]],
    ]);
  });

  it('reverses length ranges but keeps unknown last when sorting by length descending', () => {
    const { groups } = buildView(baseInput({ sortBy: 'duration', sortDir: 'desc' }));

    assert.deepEqual(groups.map((group) => group.label), ['60 min and over', '20–60 min', '5–20 min', 'Under 5 min', 'Unknown length']);
  });

  it('returns no groups when sorting by list order', () => {
    assert.deepEqual(buildView(baseInput()).groups, []);
  });
});

describe('isMusicVideo, matchesCategory, and normalizeViewPrefs', () => {
  it('counts only videos the API filed under Music as music', () => {
    const item = { videoId: 'aaaaaaaaaaa' };

    assert.equal(isMusicVideo(item, new Map([['aaaaaaaaaaa', { c: '10' }]])), true);
    assert.equal(isMusicVideo(item, new Map([['aaaaaaaaaaa', { c: '27' }]])), false);
    assert.equal(isMusicVideo(item, new Map([['aaaaaaaaaaa', { c: '' }]])), false);
    assert.equal(isMusicVideo(item, new Map()), false);
    assert.equal(matchesCategory('all', item, new Map()), true);
  });

  it('replaces values that are not options', () => {
    assert.deepEqual(normalizeViewPrefs({ groupBy: 'channel', sortBy: 'nope', sortDir: 'desc', channelOrder: 'count', durationFilter: 'lt-5', categoryFilter: 'drop table', filtersOpen: 'no' }), {
      sortBy: 'position',
      sortDir: 'desc',
      groupOrder: 'count',
      durationFilter: 'lt-5',
      categoryFilter: 'all',
      watchFilter: 'all',
      filtersOpen: true,
    });
  });

  it('keeps category IDs and reads the old music filter as category 10', () => {
    assert.equal(normalizeViewPrefs({ categoryFilter: '20' }).categoryFilter, '20');
    assert.equal(normalizeViewPrefs({ categoryFilter: 'music' }).categoryFilter, '10');
    assert.equal(normalizeViewPrefs({ categoryFilter: 'unknown' }).categoryFilter, 'unknown');
    assert.equal(normalizeViewPrefs({ sortBy: 'views' }).sortBy, 'views');
  });
});
