// Builds `sample.json`, the made-up Watch later list and the scanned
// playlist the screenshots show, from public videos of Google's and
// YouTube's own channels. It sends no cookies and reads nothing from any
// account.
//
//   npm run screenshots:sample
//
// Run it again only to refresh the sample; the screenshots are captured from
// the committed file.
import { writeFileSync } from 'node:fs';

import { loadContentScripts, plain } from '../../tests/helpers/content-scripts.mjs';

const OUT = new URL('./sample.json', import.meta.url);
const ORIGIN = 'https://www.youtube.com';
const HEADERS = { 'Accept-Language': 'en-US,en;q=0.9' };
// One page a second or so, as the extension itself paces its requests.
const REQUEST_DELAY = 1200;

// Product and developer videos from official channels, without outside
// creators or celebrities, so the screenshots promote no one.
const VIDEO_IDS = [
  // YouTube Viewers
  'YX6fCbY6CMc', 'F2YgC2dA4d4', 'BfkHDJHtvtQ', 'r008q2jm0bw', 'xAcSj94ZgsE', 'bkZDmV0w3kA',
  // Google
  'KO2bNK9L7WA', '8NPgswgbTnE', 'o1JK79jszqo', 'rPq7ITrWFvY', 'Sm7OTow3mcY', '7Z5Vy9JBANs', 'kQQbTYPt7VE',
  // Google for Developers
  '4oxA9o_OmWo', '3CyW24Pkz4o', 'JRArFxEfyQU', 'iOK1-b_9Dlg', 'KwJwYIqDMLY', 'd9LAQWKUnx8', 'KIp8PAU3oAI', 'BXzFk5kK5_Q', 'cL7uFe5RqHY',
  // Chrome for Developers
  'btIOhb6AiOc', 'KvKqDR1H2Xs', 'H5poN8Q4cuk', '2U3kFesNNcI', 'w37SORQg8II', 'wBNCPp5gdqg', '4AAiTP1B8wA', 'uT7MVcCQ4rw', 'g2qrMnvvL6E', 'ddBxvuH35tI',
  // Android Developers
  'lKqh34XT7Q8', 'HEqXwUm6vd0', 'pLNJ-fNYTKU', 'RyO2H1VbqdM', '8rbub6oDBtg', '07Rrbj4hLmA', '4BlGtrTeCMU', 'WDoxljZc5QM',
  // Firebase
  'OaRI87uwU-k', 'KMkwq9Cu1O0', 'A8zq0xfXlvY', '16jTqLC66PU', 'FV9hjuIeR8o', '5AWbCj_LxFI',
  // Flutter
  'vNwCw6uVyTg', 'I1uIbGh1dGE', 'tXeyaV1gVJk', 'NR4F9y8uTvw', 'lPWrd08swlw', 'iBRrnCqzTuk', '2z7U6GU7QwQ',
  // Google DeepMind
  '_6jZlnRsXXQ', 'U0aToL5C-bQ', '4lSQnrMC6nY', 'O_EWbnkjXdk', 'pZNzfQLgGsA', '1DtMiRKg-cs',
  // Made by Google
  'fOry1J5BCkU', 'NqRjWiWKAME', '49_3JvYFgnE',
  // Google Workspace
  'lXuWCC9ycXs', 'WshA826u3gU', 'Lj7PNYNs73o', 'qnNn6tsW-2U', '4P3iKlmQmM0', 'LzmdR0sYNDc',
];

// A public playlist, scanned the way the extension scans one while signed
// out: Flutter's "Widget of the Week".
const PLAYLIST_ID = 'PLjxrf2q8roU23XGwz3Km7sQZFTdB996iG';

// The IDs `videoCategories.list` gives the English category names.
const CATEGORY_IDS = {
  'Film & Animation': '1',
  'Autos & Vehicles': '2',
  Music: '10',
  'Pets & Animals': '15',
  Sports: '17',
  'Travel & Events': '19',
  Gaming: '20',
  'People & Blogs': '22',
  Comedy: '23',
  Entertainment: '24',
  'News & Politics': '25',
  'Howto & Style': '26',
  Education: '27',
  'Science & Technology': '28',
  'Nonprofits & Activism': '29',
};

// When the sample lists were scanned: 2026-09-30, 2:20 PM in New York, the
// time zone the screenshots are captured in.
const SCANNED_AT = Date.UTC(2026, 8, 30, 18, 20);
const PLAYLIST_SCANNED_AT = SCANNED_AT - 26 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

// Pages are asked for in English. The continuation requests carry the
// language in their body, which the collector copies from the page.
const request = (input, init = {}) => {
  const url = new URL(input, ORIGIN);

  if (!url.pathname.startsWith('/youtubei/')) {
    url.searchParams.set('hl', 'en');
    url.searchParams.set('gl', 'US');
  }

  return fetch(url, { ...init, headers: { ...init.headers, ...HEADERS } });
};

// The same fixed order on every run.
const createRandom = (seed) => {
  let state = seed;

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;

    return state / 4294967296;
  };
};

const toDurationText = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, '0');

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
};

const { collector } = loadContentScripts({
  fetch: request,
  location: new URL(`/playlist?list=${PLAYLIST_ID}`, ORIGIN),
  document: { cookie: '', visibilityState: 'visible' },
});

// Title, channel, and length, plus what the Data API would report: the
// category, the publish date, and the view count.
const readVideo = async (videoId) => {
  const response = await request(`/watch?v=${videoId}`);
  const player = collector.findAssignedObject(await response.text(), ['var ytInitialPlayerResponse = ']);
  const details = player?.videoDetails;
  const microformat = player?.microformat?.playerMicroformatRenderer;

  if (!details || !microformat) {
    throw new Error(`No player data for ${videoId} (HTTP ${response.status}).`);
  }

  const seconds = Number(details.lengthSeconds);

  return {
    item: {
      videoId,
      title: details.title,
      channelName: details.author,
      channelId: details.channelId,
      durationSeconds: seconds,
      durationText: toDurationText(seconds),
    },
    info: {
      c: CATEGORY_IDS[microformat.category] ?? '',
      p: Date.parse(microformat.publishDate),
      v: Number(details.viewCount),
      t: SCANNED_AT + 60 * 1000,
    },
    category: microformat.category,
  };
};

const random = createRandom(20260930);
const videos = [];

for (const videoId of VIDEO_IDS) {
  videos.push(await readVideo(videoId));
  console.log(`${videos.length}/${VIDEO_IDS.length} ${videoId}`);
  await sleep(REQUEST_DELAY);
}

for (let index = videos.length - 1; index > 0; index -= 1) {
  const other = Math.floor(random() * (index + 1));

  [videos[index], videos[other]] = [videos[other], videos[index]];
}

// Some videos were finished and some started, as in a list someone uses.
const items = videos.map(({ item }, index) => {
  const roll = random();
  let watchedPercent = null;

  if (roll < 0.14) {
    watchedPercent = 100;
  } else if (roll < 0.36) {
    watchedPercent = 8 + Math.floor(random() * 70);
  }

  return { ...item, position: index + 1, watchedPercent };
});

const playlist = plain(await collector.collect({ listId: PLAYLIST_ID }));
const categoryNames = Object.fromEntries(videos.filter(({ info }) => info.c).map(({ info, category }) => [info.c, category]));

const sample = {
  scannedAt: SCANNED_AT,
  lists: {
    WL: {
      version: 2,
      listId: 'WL',
      title: 'Watch later',
      collectedAt: SCANNED_AT,
      method: 'data',
      removeLabel: 'Remove from Watch later',
      items,
    },
    [PLAYLIST_ID]: {
      version: 2,
      listId: PLAYLIST_ID,
      title: playlist.title,
      collectedAt: PLAYLIST_SCANNED_AT,
      method: 'data',
      removeLabel: null,
      items: playlist.items.map(({ thumbnail, ...item }) => ({ ...item, watchedPercent: null })),
    },
  },
  videoInfo: Object.fromEntries(videos.map(({ item, info }) => [item.videoId, info])),
  categoryNames,
};

writeFileSync(OUT, `${JSON.stringify(sample, null, 2)}\n`);
console.log(`Wrote ${items.length} videos and a playlist of ${playlist.items.length}.`);
