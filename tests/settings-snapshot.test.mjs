import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS, normalizeSettings, parseBounds, validateSettingsForm } from '../src/manager/lib/settings.js';
import { createSnapshot, pruneSnapshots, readSnapshot, removeFromSnapshot } from '../src/manager/lib/snapshot.js';

describe('settings', () => {
  it('parses bounds in any order and drops duplicates', () => {
    assert.deepEqual(parseBounds('60, 5 20,5'), { value: [5, 20, 60] });
  });

  it('rejects bounds that are not whole minutes in range', () => {
    assert.ok(parseBounds('').error);
    assert.ok(parseBounds('5, 2.5').error);
    assert.ok(parseBounds('0, 10').error);
    assert.ok(parseBounds('1,2,3,4,5,6,7,8,9').error);
  });

  it('refuses a removal delay under one second', () => {
    const { errors } = validateSettingsForm({ boundsText: '5,20', delayMin: '0.5', delayMax: '2', testModeCount: '3', apiKey: '' });

    assert.ok(errors.delayMin);
  });

  it('refuses a maximum delay shorter than the minimum', () => {
    const { errors } = validateSettingsForm({ boundsText: '5', delayMin: '3', delayMax: '2', testModeCount: '3', apiKey: '' });

    assert.ok(errors.delayMax);
  });

  it('returns clean settings for a valid form', () => {
    const { settings, errors } = validateSettingsForm({
      boundsText: '10, 30',
      delayMin: '1.5',
      delayMax: '3',
      testModeCount: '5',
      apiKey: '  AIzaSyExampleExampleExample0000000  ',
    });

    assert.equal(errors, undefined);
    assert.deepEqual(settings, {
      durationBounds: [10, 30],
      removeDelayMin: 1.5,
      removeDelayMax: 3,
      testModeCount: 5,
      apiKey: 'AIzaSyExampleExampleExample0000000',
    });
  });

  it('falls back to defaults for missing or broken stored values', () => {
    assert.deepEqual(normalizeSettings(null), { ...DEFAULT_SETTINGS, durationBounds: [5, 20, 60] });
    assert.deepEqual(normalizeSettings({ removeDelayMin: 0.1, removeDelayMax: 99, testModeCount: 3.5, apiKey: 'bad key' }), {
      ...DEFAULT_SETTINGS,
      durationBounds: [5, 20, 60],
    });
  });
});

describe('snapshot', () => {
  const raw = [
    { videoId: 'aaaaaaaaaaa', title: 'A', channelName: 'X', durationSeconds: 10, thumbnail: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hq.jpg', watchedPercent: 45 },
    { videoId: 'not-an-id', title: 'Invalid' },
    { videoId: 'bbbbbbbbbbb', title: 'B', durationSeconds: -3, watchedPercent: 140 },
    { videoId: 'aaaaaaaaaaa', title: 'Repeated' },
    { videoId: 'ccccccccccc', title: 'C', durationSeconds: 1.5 },
  ];

  it('keeps valid entries in order, numbered from 1', () => {
    const snapshot = createSnapshot({ items: raw, removeLabel: 'Remove', method: 'data', collectedAt: 1 });

    assert.deepEqual(snapshot.items.map((item) => [item.position, item.videoId]), [[1, 'aaaaaaaaaaa'], [2, 'bbbbbbbbbbb'], [3, 'ccccccccccc']]);
    assert.equal(snapshot.items[0].title, 'A');
  });

  it('checks numbers and does not store thumbnail addresses', () => {
    const [first, second, third] = createSnapshot({ items: raw, collectedAt: 1 }).items;

    assert.equal(second.durationSeconds, null);
    assert.equal(third.durationSeconds, null);
    assert.equal(first.watchedPercent, 45);
    assert.equal(second.watchedPercent, null);
    assert.equal('thumbnail' in first, false);
  });

  it('records the list it belongs to, with Watch later as the default', () => {
    assert.deepEqual(
      (({ listId, title }) => [listId, title])(createSnapshot({ items: [], collectedAt: 1 })),
      ['WL', '나중에 볼 동영상'],
    );
    assert.deepEqual(
      (({ listId, title }) => [listId, title])(createSnapshot({ listId: 'PLabc123', title: ' 여행 ', items: [], collectedAt: 1 })),
      ['PLabc123', '여행'],
    );
    assert.equal(createSnapshot({ listId: 'bad id!', items: [], collectedAt: 1 }).listId, 'WL');
  });

  it('renumbers the list after a removal', () => {
    const snapshot = createSnapshot({ items: raw, collectedAt: 1 });
    const after = removeFromSnapshot(snapshot, new Set(['aaaaaaaaaaa']));

    assert.deepEqual(after.items.map((item) => [item.position, item.videoId]), [[1, 'bbbbbbbbbbb'], [2, 'ccccccccccc']]);
  });

  it('reads a version 1 snapshot as Watch later', () => {
    const snapshot = readSnapshot({ version: 1, collectedAt: 5, method: 'data', items: raw });

    assert.equal(snapshot.version, 2);
    assert.equal(snapshot.listId, 'WL');
    assert.equal(snapshot.items.length, 3);
  });

  it('ignores stored data from another version', () => {
    assert.equal(readSnapshot({ version: 99, items: [] }), null);
    assert.equal(readSnapshot(undefined), null);
  });
});

describe('pruneSnapshots', () => {
  const list = (listId, collectedAt, count) => createSnapshot({
    listId,
    collectedAt,
    items: Array.from({ length: count }, (_, index) => ({ videoId: `${listId.slice(0, 2)}${String(index).padStart(9, '0')}` })),
  });

  it('keeps the list just scanned and Watch later, then the newest others that fit', () => {
    const snapshots = {
      WL: list('WL', 1, 3),
      PLa1: list('PLa1', 2, 3),
      PLb1: list('PLb1', 5, 3),
      PLc1: list('PLc1', 4, 3),
      PLd1: list('PLd1', 3, 3),
    };

    assert.deepEqual(Object.keys(pruneSnapshots(snapshots, 'PLa1', { lists: 3, items: 100 })).sort(), ['PLa1', 'PLb1', 'WL']);
  });

  it('stops adding lists at the item limit', () => {
    const snapshots = { WL: list('WL', 1, 5), PLa1: list('PLa1', 3, 5), PLb1: list('PLb1', 2, 1) };

    assert.deepEqual(Object.keys(pruneSnapshots(snapshots, 'WL', { lists: 6, items: 8 })).sort(), ['PLb1', 'WL']);
  });
});
