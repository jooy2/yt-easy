import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSearchText,
  buildView,
  createBuckets,
  findBucket,
  matchesCategory,
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
  categories: new Map(),
  buckets: createBuckets([5, 20, 60]),
  groupBy: 'none',
  sortBy: 'position',
  sortDir: 'asc',
  ...overrides,
});

const positions = (items) => items.map((entry) => entry.position);

describe('duration buckets', () => {
  const buckets = createBuckets([5, 20, 60]);

  it('builds labelled ranges from the bounds', () => {
    assert.deepEqual(buckets.map((bucket) => bucket.label), ['5분 미만', '5–20분', '20–60분', '60분 이상', '길이 정보 없음']);
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

  it('sorts by channel name, Korean names first, and breaks ties by list order', () => {
    assert.deepEqual(positions(sortItems(ITEMS, 'channel', 'asc')), [1, 3, 4, 2, 5]);
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

  it('filters by music category', () => {
    const categories = new Map([[ITEMS[0].videoId, '10'], [ITEMS[1].videoId, '27'], [ITEMS[2].videoId, '']]);

    assert.deepEqual(positions(buildView(baseInput({ categories, categoryFilter: 'music' })).items), [1]);
    assert.deepEqual(positions(buildView(baseInput({ categories, categoryFilter: 'other' })).items), [2]);
    assert.deepEqual(positions(buildView(baseInput({ categories, categoryFilter: 'unknown' })).items), [3, 4, 5]);
  });

  it('groups by channel with the largest channels first', () => {
    const { groups } = buildView(baseInput({ groupBy: 'channel' }));

    assert.deepEqual(groups.map((group) => [group.label, group.count]), [['가나다 채널', 2], ['Zeta', 2], ['Alpha', 1]]);
    assert.equal(groups[0].totalSeconds, 3900);
    assert.deepEqual(positions(groups[1].items), [2, 5]);
  });

  it('orders channel groups by name when sorting by channel', () => {
    const { groups } = buildView(baseInput({ groupBy: 'channel', sortBy: 'channel', sortDir: 'desc' }));

    assert.deepEqual(groups.map((group) => group.label), ['Zeta', 'Alpha', '가나다 채널']);
  });

  it('groups by duration in bucket order and leaves out empty buckets', () => {
    const { groups } = buildView(baseInput({ groupBy: 'duration' }));

    assert.deepEqual(groups.map((group) => [group.label, positions(group.items)]), [
      ['5분 미만', [2]],
      ['5–20분', [5]],
      ['20–60분', [4]],
      ['60분 이상', [1]],
      ['길이 정보 없음', [3]],
    ]);
  });

  it('reverses duration groups but keeps unknown last when sorting by length descending', () => {
    const { groups } = buildView(baseInput({ groupBy: 'duration', sortBy: 'duration', sortDir: 'desc' }));

    assert.deepEqual(groups.map((group) => group.label), ['60분 이상', '20–60분', '5–20분', '5분 미만', '길이 정보 없음']);
  });

  it('returns no groups without grouping', () => {
    assert.deepEqual(buildView(baseInput()).groups, []);
  });
});

describe('matchesCategory and normalizeViewPrefs', () => {
  it('treats a video the API had no record of as unknown', () => {
    assert.equal(matchesCategory('unknown', ''), true);
    assert.equal(matchesCategory('other', ''), false);
    assert.equal(matchesCategory('all', undefined), true);
  });

  it('replaces values that are not options', () => {
    assert.deepEqual(normalizeViewPrefs({ groupBy: 'channel', sortBy: 'nope', sortDir: 'desc', durationFilter: 'lt-5', filtersOpen: 'no' }), {
      groupBy: 'channel',
      sortBy: 'position',
      sortDir: 'desc',
      durationFilter: 'lt-5',
      categoryFilter: 'all',
      filtersOpen: true,
    });
  });
});
