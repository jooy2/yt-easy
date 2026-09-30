import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addAll, readCoverage, removeAll, selectRange, toggleOne } from '../src/manager/lib/selection.js';

const IDS = ['a', 'b', 'c', 'd', 'e'];
const sorted = (set) => [...set].sort();

describe('selection', () => {
  it('toggles one video', () => {
    assert.deepEqual(sorted(toggleOne(new Set(['a']), 'b')), ['a', 'b']);
    assert.deepEqual(sorted(toggleOne(new Set(['a', 'b']), 'b')), ['a']);
  });

  it('selects the range from a checked anchor, in either direction', () => {
    assert.deepEqual(sorted(selectRange({ selected: new Set(['b']), videoIds: IDS, anchorId: 'b', targetId: 'd' })), ['b', 'c', 'd']);
    assert.deepEqual(sorted(selectRange({ selected: new Set(['d']), videoIds: IDS, anchorId: 'd', targetId: 'a' })), ['a', 'b', 'c', 'd']);
  });

  it('clears the range from an unchecked anchor', () => {
    const selected = new Set(['a', 'c', 'd', 'e']);

    assert.deepEqual(sorted(selectRange({ selected, videoIds: IDS, anchorId: 'b', targetId: 'd' })), ['a', 'e']);
  });

  it('keeps videos outside the list as they were', () => {
    const selected = new Set(['z', 'a']);

    assert.deepEqual(sorted(selectRange({ selected, videoIds: IDS, anchorId: 'a', targetId: 'c' })), ['a', 'b', 'c', 'z']);
  });

  it('toggles the clicked video when the anchor is not in the list', () => {
    assert.deepEqual(sorted(selectRange({ selected: new Set(), videoIds: IDS, anchorId: 'z', targetId: 'c' })), ['c']);
    assert.deepEqual(sorted(selectRange({ selected: new Set(), videoIds: IDS, anchorId: null, targetId: 'c' })), ['c']);
  });

  it('adds, removes, and reports coverage for a list', () => {
    const selected = addAll(new Set(['z']), ['a', 'b']);

    assert.deepEqual(sorted(selected), ['a', 'b', 'z']);
    assert.equal(readCoverage(selected, ['a', 'b']), 'all');
    assert.equal(readCoverage(selected, ['a', 'c']), 'some');
    assert.equal(readCoverage(removeAll(selected, ['a', 'b']), ['a', 'b']), 'none');
  });
});
