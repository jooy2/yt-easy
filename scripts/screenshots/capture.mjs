// Captures the screenshots for the README and the Chrome Web Store from the
// built extension, with the sample lists in `sample.json`, in a new headless
// Chrome profile that is signed in to nothing.
//
//   npm run screenshots
//
// README images go to `.github/resources/screenshots/` as WebP at twice the
// page size. Web Store images go to `.github/resources/store/` as PNG without
// transparency: the 1280x800 screenshots, and the promo images drawn in
// `promo.html`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { t } from '../../src/i18n/runtime.js';

import { launchChrome, sleep } from './cdp.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = `${ROOT}dist`;
const README_DIR = `${ROOT}.github/resources/screenshots`;
const STORE_DIR = `${ROOT}.github/resources/store`;

// The page is laid out at 1024x640 and captured at 1.25x for the store,
// which gives exactly 1280x800, and at 2x for the README.
const VIEWPORT = { width: 1024, height: 640 };
const STORE_SCALE = 1.25;
const README_SCALE = 2;
const README_QUALITY = 88;
const LANG = 'en-US';
const TIME_ZONE = 'America/New_York';
const IMAGE_TIMEOUT = 8000;

// The store's small promo tile, which it requires, and its marquee image.
const PROMOS = [
  { name: 'promo-small', size: 'small', width: 440, height: 280 },
  { name: 'promo-marquee', size: 'marquee', width: 1400, height: 560 },
];

const sample = JSON.parse(readFileSync(new URL('./sample.json', import.meta.url), 'utf8'));

// Not a key: its presence alone turns on the category, date, and view
// options, which read the looked-up info from the sample. Nothing is sent to
// the Data API.
const SETTINGS = { durationBounds: [5, 20, 60], removeDelayMin: 1, removeDelayMax: 2, testModeCount: 3, apiKey: 'sample-key-for-screenshots-only' };

const byText = (selector, text) => `[...document.querySelectorAll(${JSON.stringify(selector)})].find((element) => element.textContent.includes(${JSON.stringify(text)}))`;

const selectChannelRows = async (page) => {
  await page.click(byText('[role="tab"]', 'Chrome for Developers'));
  await page.clickRow(0);
  await page.clickRow(1);
  await page.clickRow(3);
};

// `readme` and `store` name the files each scene is saved as, if any.
const SCENES = [
  {
    readme: 'channels',
    store: '01-channels',
    prefs: { sortBy: 'channel', groupOrder: 'count', filtersOpen: false },
    actions: selectChannelRows,
  },
  {
    readme: 'channels-dark',
    dark: true,
    prefs: { sortBy: 'channel', groupOrder: 'count', filtersOpen: false },
    actions: selectChannelRows,
  },
  {
    readme: 'filters',
    store: '02-filters',
    prefs: { sortBy: 'duration', watchFilter: 'unwatched' },
    actions: (page) => page.click(byText('[role="tab"]', t('duration.range', { min: 5, max: 20 }))),
  },
  {
    readme: 'remove',
    store: '03-remove',
    prefs: { watchFilter: 'watched' },
    actions: async (page) => {
      await page.click('document.querySelector(".list-header [role=checkbox]")');
      await page.click(byText('.selection-actions button', t('selection.remove')));
      await sleep(600);
      await page.click(byText('[role="dialog"] label', t('remove.backup')));
    },
  },
  {
    readme: 'views',
    store: '04-views',
    prefs: { sortBy: 'views', sortDir: 'desc' },
  },
  {
    readme: 'playlists',
    store: '05-playlists',
    actions: async (page) => {
      await page.click('document.querySelector(".source-button")');
      await sleep(500);
    },
  },
];

const openPage = async ({ browser, url, scene }) => {
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params) => browser.send(method, params, sessionId);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    }

    return result.value;
  };

  const moveMouse = (x, y) => call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });

  // Real pointer events, since the controls react to them rather than to a
  // bare click().
  const click = async (expression) => {
    const point = await evaluate(`(() => {
      const element = ${expression};

      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();

      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);

    if (!point) {
      throw new Error(`Nothing matches ${expression}`);
    }

    await moveMouse(point.x, point.y);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
    await sleep(250);
  };

  // Rows are positioned by transform, so the DOM order is not the screen order.
  const clickRow = (index) => click(`[...document.querySelectorAll('.video-row')]
    .sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y)[${index}]
    .querySelector('.video-text')`);

  await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: STORE_SCALE, mobile: false });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scene.dark ? 'dark' : 'light' }] });
  await call('Emulation.setTimezoneOverride', { timezoneId: TIME_ZONE });
  await call('Page.navigate', { url });
  await sleep(800);
  await evaluate(`chrome.storage.local.clear().then(() => chrome.storage.local.set(${JSON.stringify({
    snapshots: { savedBy: 'sample', lists: sample.lists },
    activeListId: 'WL',
    videoInfo: sample.videoInfo,
    categoryNames: sample.categoryNames,
    settings: SETTINGS,
    viewPrefs: scene.prefs ?? {},
  })})).then(() => true)`);
  await call('Page.reload');
  await sleep(1500);

  const waitForImages = () => evaluate(`Promise.race([
    Promise.all([...document.images]
      .filter((image) => image.getBoundingClientRect().bottom > 0 && image.getBoundingClientRect().top < innerHeight)
      .map((image) => (image.complete ? true : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve; })))),
    new Promise((resolve) => setTimeout(resolve, ${IMAGE_TIMEOUT})),
  ]).then(() => true)`);

  const capture = async ({ scale, format, quality }) => {
    await call('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: scale, mobile: false });
    await sleep(700);

    const { data } = await call('Page.captureScreenshot', { format, quality });

    return Buffer.from(data, 'base64');
  };

  const close = () => browser.send('Target.closeTarget', { targetId });

  return { click, clickRow, moveMouse, waitForImages, capture, close };
};

mkdirSync(README_DIR, { recursive: true });
mkdirSync(STORE_DIR, { recursive: true });

const browser = launchChrome({ lang: LANG });

try {
  const { id } = await browser.send('Extensions.loadUnpacked', { path: DIST });
  const url = `chrome-extension://${id}/src/manager/manager.html?view=tab`;

  for (const scene of SCENES) {
    const page = await openPage({ browser, url, scene });

    await scene.actions?.(page);
    // The pointer rests where it shows no hover state or tooltip.
    await page.moveMouse(VIEWPORT.width - 4, VIEWPORT.height - 4);
    await page.waitForImages();
    await sleep(800);

    if (scene.store) {
      writeFileSync(`${STORE_DIR}/${scene.store}.png`, await page.capture({ scale: STORE_SCALE, format: 'png' }));
    }

    if (scene.readme) {
      writeFileSync(`${README_DIR}/${scene.readme}.webp`, await page.capture({ scale: README_SCALE, format: 'webp', quality: README_QUALITY }));
    }

    await page.close();
    console.log(`Captured ${scene.readme ?? scene.store}.`);
  }

  for (const promo of PROMOS) {
    const url = new URL(`?size=${promo.size}`, pathToFileURL(fileURLToPath(new URL('./promo.html', import.meta.url))));
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
    const call = (method, params) => browser.send(method, params, sessionId);

    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: promo.width, height: promo.height, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: url.href });
    await call('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => Promise.all([...document.images].map((image) => image.decode())))', awaitPromise: true });
    await sleep(300);

    const { data } = await call('Page.captureScreenshot', { format: 'png' });

    writeFileSync(`${STORE_DIR}/${promo.name}.png`, Buffer.from(data, 'base64'));
    await browser.send('Target.closeTarget', { targetId });
    console.log(`Captured ${promo.name}.`);
  }
} finally {
  await browser.close();
}
