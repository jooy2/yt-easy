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

// Asks the content script to move the tab inside YouTube's own app, which
// loads only the video and keeps the page. Resolves to its answer, or null
// when no content script answers, as in a tab opened before the extension
// was installed.
const openInPage = (tab, videoId) => chrome.tabs.sendMessage(tab.id, { type: 'open-video', videoId }).catch(() => null);

// Shows the video in the tab the side panel sits beside. A YouTube tab moves
// to it the way a click inside YouTube would, and loads the address only
// when that does not work. When the tab shows another site, when the manager
// itself is the tab, or when the YouTube tab is running a job, the video
// opens in a new tab next to it, so no other page is replaced.
// Resolves to 'current' or 'new'.
export const openInCurrentTab = async (videoId) => {
  const url = toVideoUrl(videoId);
  const tab = await getActiveTab();

  if (isYouTubeTab(tab)) {
    const answer = await openInPage(tab, videoId);

    if (answer?.ok) {
      return 'current';
    }

    if (!answer?.busy) {
      await chrome.tabs.update(tab.id, { url });
      return 'current';
    }
  }

  await createTabNextTo(tab, url);

  return 'new';
};

export const openInNewTab = async (videoId) => {
  await createTabNextTo(await getActiveTab(), toVideoUrl(videoId));
};
