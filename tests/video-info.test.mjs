import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { needsCategoryNames, readCategoryItems, readNamesLocale, readVideoItems } from '../src/manager/lib/video-info.js';

describe('reading Data API responses', () => {
  it('reads the category, publish time, and views of each video', () => {
    const body = {
      items: [
        { id: 'aaaaaaaaaaa', snippet: { categoryId: '10', publishedAt: '2019-03-04T05:06:07Z' }, statistics: { viewCount: '680000' } },
        { id: 'bbbbbbbbbbb', snippet: { categoryId: 'x', publishedAt: 'not a date' }, statistics: {} },
        { id: 'zzzzzzzzzzz', snippet: { categoryId: '20' } },
      ],
    };
    const entries = new Map(readVideoItems({ videoIds: ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'], body, now: 42 }));

    assert.deepEqual(entries.get('aaaaaaaaaaa'), { c: '10', p: Date.UTC(2019, 2, 4, 5, 6, 7), v: 680000, t: 42 });
    assert.deepEqual(entries.get('bbbbbbbbbbb'), { c: '', p: null, v: null, t: 42 });
    // Asked for but not returned, as for a deleted video: looked up, no record.
    assert.deepEqual(entries.get('ccccccccccc'), { c: '', p: null, v: null, t: 42 });
    // Returned but not asked for: ignored.
    assert.equal(entries.has('zzzzzzzzzzz'), false);
  });

  it('reads category names', () => {
    const names = readCategoryItems({ items: [{ id: '10', snippet: { title: ' Music ' } }, { id: 'x', snippet: { title: 'bad' } }, { id: '20' }] });

    assert.deepEqual([...names], [['10', 'Music']]);
  });
});

describe('the language of category names', () => {
  const names = new Map([['10', 'Music']]);

  it('asks for names when there are none, or when they are in another language', () => {
    assert.equal(needsCategoryNames({ names: new Map(), namesLocale: 'en', currentLocale: 'en' }), true);
    assert.equal(needsCategoryNames({ names, namesLocale: 'ko', currentLocale: 'en' }), true);
    assert.equal(needsCategoryNames({ names, namesLocale: 'en', currentLocale: 'en' }), false);
  });

  it('reads names stored without a language as Korean, as earlier versions asked for them', () => {
    assert.equal(readNamesLocale(undefined), 'ko');
    assert.equal(readNamesLocale('en'), 'en');
    assert.equal(readNamesLocale('<script>'), 'ko');
  });
});
