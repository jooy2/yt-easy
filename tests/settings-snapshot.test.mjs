import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS, normalizeSettings, parseBounds, validateSettingsForm } from '../src/manager/settings.js';
import { createSnapshot, readSnapshot, removeFromSnapshot } from '../src/manager/snapshot.js';

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
    { videoId: 'aaaaaaaaaaa', title: 'A', channelName: 'X', durationSeconds: 10, thumbnail: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hq.jpg' },
    { videoId: 'not-an-id', title: 'Invalid' },
    { videoId: 'bbbbbbbbbbb', title: 'B', durationSeconds: -3, thumbnail: 'javascript:alert(1)' },
    { videoId: 'aaaaaaaaaaa', title: 'Repeated' },
    { videoId: 'ccccccccccc', title: 'C', durationSeconds: 1.5, thumbnail: 'https://evil.example/ytimg.com.jpg' },
  ];

  it('keeps valid entries in order, numbered from 1', () => {
    const snapshot = createSnapshot({ items: raw, removeLabel: 'Remove', method: 'data', collectedAt: 1 });

    assert.deepEqual(snapshot.items.map((item) => [item.position, item.videoId]), [[1, 'aaaaaaaaaaa'], [2, 'bbbbbbbbbbb'], [3, 'ccccccccccc']]);
    assert.equal(snapshot.items[0].title, 'A');
  });

  it('only keeps thumbnails from YouTube image hosts', () => {
    const [first, second, third] = createSnapshot({ items: raw, collectedAt: 1 }).items;

    assert.equal(first.thumbnail, 'https://i.ytimg.com/vi/aaaaaaaaaaa/hq.jpg');
    assert.equal(second.thumbnail, 'https://i.ytimg.com/vi/bbbbbbbbbbb/mqdefault.jpg');
    assert.equal(third.thumbnail, 'https://i.ytimg.com/vi/ccccccccccc/mqdefault.jpg');
    assert.equal(second.durationSeconds, null);
    assert.equal(third.durationSeconds, null);
  });

  it('renumbers the list after a removal', () => {
    const snapshot = createSnapshot({ items: raw, collectedAt: 1 });
    const after = removeFromSnapshot(snapshot, new Set(['aaaaaaaaaaa']));

    assert.deepEqual(after.items.map((item) => [item.position, item.videoId]), [[1, 'bbbbbbbbbbb'], [2, 'ccccccccccc']]);
  });

  it('ignores stored data from another version', () => {
    assert.equal(readSnapshot({ version: 99, items: [] }), null);
    assert.equal(readSnapshot(undefined), null);
  });
});
