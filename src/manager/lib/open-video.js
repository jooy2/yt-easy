import { toVideoUrl } from './export.js';

const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com']);

// `tab.url` is only visible for sites the extension may access, so any other
// site reads as not YouTube.
const isYouTubeTab = (tab) => {
  try {
    return YOUTUBE_HOSTS.has(new URL(tab?.url ?? '').hostname);
  } catch {
    return false;
  }
};

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  return tab ?? null;
};

const createTabNextTo = (tab, url) => chrome.tabs.create({
  url,
  active: true,
  ...(tab ? { index: tab.index + 1, openerTabId: tab.id } : {}),
});

// Loads the video in the tab the side panel sits beside. When that tab shows
// another site, or when the manager itself is the tab, the video opens in a
// new tab next to it instead, so no other page is replaced.
// Resolves to 'current' or 'new'.
export const openInCurrentTab = async (videoId) => {
  const url = toVideoUrl(videoId);
  const tab = await getActiveTab();

  if (isYouTubeTab(tab)) {
    await chrome.tabs.update(tab.id, { url });
    return 'current';
  }

  await createTabNextTo(tab, url);

  return 'new';
};

export const openInNewTab = async (videoId) => {
  await createTabNextTo(await getActiveTab(), toVideoUrl(videoId));
};
