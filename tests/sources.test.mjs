import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parsePlaylistInput, toFileSlug, toPlaylistUrl } from '../src/manager/lib/sources.js';

describe('parsePlaylistInput', () => {
  it('reads the ID from playlist and video addresses', () => {
    assert.deepEqual(parsePlaylistInput('https://www.youtube.com/playlist?list=PLabcDEF_123-x'), { listId: 'PLabcDEF_123-x' });
    assert.deepEqual(parsePlaylistInput('https://www.youtube.com/watch?v=abcdefghijk&list=PLxyz987&index=3'), { listId: 'PLxyz987' });
    assert.deepEqual(parsePlaylistInput('m.youtube.com/playlist?list=PLmobile1'), { listId: 'PLmobile1' });
    assert.deepEqual(parsePlaylistInput('https://youtu.be/abcdefghijk?list=PLshort1'), { listId: 'PLshort1' });
  });

  it('accepts a bare ID, including Watch later', () => {
    assert.deepEqual(parsePlaylistInput('  PLbare123  '), { listId: 'PLbare123' });
    assert.deepEqual(parsePlaylistInput('WL'), { listId: 'WL' });
  });

  it('explains what is wrong with anything else', () => {
    assert.ok(parsePlaylistInput('').error);
    assert.ok(parsePlaylistInput('https://example.com/playlist?list=PLabc123').error);
    assert.ok(parsePlaylistInput('https://www.youtube.com/watch?v=abcdefghijk').error);
    assert.ok(parsePlaylistInput('not a playlist at all').error);
  });
});

describe('list names', () => {
  it('builds addresses and file name parts', () => {
    assert.equal(toPlaylistUrl('PLabc123'), 'https://www.youtube.com/playlist?list=PLabc123');
    assert.equal(toFileSlug('WL'), 'wl');
    assert.equal(toFileSlug('PLabc123'), 'playlist-PLabc123');
  });
});
