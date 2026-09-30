import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildCsv, buildFileName, buildJson, escapeCsvCell } from '../src/manager/lib/export.js';
import { formatDuration, formatFileStamp, formatTotalDuration } from '../src/manager/lib/format.js';

const ITEM = {
  position: 1,
  videoId: 'abcdefghijk',
  title: 'Title, with "quotes"',
  channelName: '채널',
  channelId: 'UCchannel',
  durationSeconds: 245,
  durationText: '4:05',
  watchedPercent: 45,
};

describe('CSV', () => {
  it('quotes cells that hold commas, quotes, or line breaks', () => {
    assert.equal(escapeCsvCell('plain'), 'plain');
    assert.equal(escapeCsvCell('a,b'), '"a,b"');
    assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
    assert.equal(escapeCsvCell('two\nlines'), '"two\nlines"');
    assert.equal(escapeCsvCell(null), '');
  });

  it('keeps a spreadsheet from running a title as a formula', () => {
    assert.equal(escapeCsvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
    assert.equal(escapeCsvCell('+1 trick'), "'+1 trick");
    assert.equal(escapeCsvCell('@home'), "'@home");
  });

  it('writes a BOM, a header, and one row per video', () => {
    const info = new Map([[ITEM.videoId, { c: '10', p: Date.UTC(2019, 2, 4), v: 680000, t: Date.UTC(2026, 8, 30) }]]);
    const csv = buildCsv([ITEM], { info, names: new Map([['10', '음악']]) });
    const lines = csv.split('\r\n');

    assert.ok(csv.startsWith('﻿'));
    assert.equal(lines[0], '﻿position,video_id,title,channel_name,channel_id,duration_seconds,duration,category_id,category_name,published_at,view_count,info_looked_up_at,watched_percent,url,thumbnail');
    assert.equal(lines[1], `1,abcdefghijk,"Title, with ""quotes""",채널,UCchannel,245,4:05,10,음악,2019-03-04T00:00:00.000Z,680000,2026-09-30T00:00:00.000Z,45,https://www.youtube.com/watch?v=abcdefghijk,https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg`);
    assert.equal(lines[2], '');
  });
});

describe('JSON', () => {
  it('records Watch later as the source when no list is given', () => {
    const json = JSON.parse(buildJson({ items: [ITEM], kind: 'export', exportedAt: Date.UTC(2026, 8, 30, 5, 0, 0) }));

    assert.equal(json.source, 'https://www.youtube.com/playlist?list=WL');
    assert.equal(json.listId, 'WL');
    assert.equal(json.kind, 'export');
    assert.equal(json.exportedAt, '2026-09-30T05:00:00.000Z');
    assert.equal(json.count, 1);
    assert.equal(json.items[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.equal(json.items[0].categoryId, null);
    assert.equal(json.items[0].viewCount, null);
    assert.equal(json.items[0].watchedPercent, 45);
    assert.equal(json.items[0].thumbnail, 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg');
  });

  it('records the playlist a file came from', () => {
    const json = JSON.parse(buildJson({ items: [ITEM], kind: 'export', exportedAt: 0, listId: 'PLabc123', listTitle: '여행' }));

    assert.equal(json.source, 'https://www.youtube.com/playlist?list=PLabc123');
    assert.deepEqual([json.listId, json.listTitle], ['PLabc123', '여행']);
  });
});

describe('formatting', () => {
  it('formats durations and totals', () => {
    assert.equal(formatDuration(245), '4:05');
    assert.equal(formatDuration(3723), '1:02:03');
    assert.equal(formatDuration(null), '');
    assert.equal(formatTotalDuration(12000), '3시간 20분');
    assert.equal(formatTotalDuration(7200), '2시간');
    assert.equal(formatTotalDuration(45), '45초');
    assert.equal(formatTotalDuration(5032 * 3600 + 58 * 60), '5,032시간 58분');
  });

  it('builds file names in the yt-easy folder', () => {
    const stamp = formatFileStamp(new Date(2026, 8, 30, 14, 5, 9));

    assert.equal(stamp, '20260930-140509');
    assert.equal(buildFileName({ prefix: 'wl-export', stamp, extension: 'csv' }), 'yt-easy/wl-export-20260930-140509.csv');
  });
});
