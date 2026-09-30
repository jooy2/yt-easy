// The lists the manager can scan: Watch later, and any playlist the user
// names by its address or ID.
import { t } from '../../i18n/runtime.js';

export const WATCH_LATER_ID = 'WL';
export const WATCH_LATER_TITLE = t('source.watch-later');

const LIST_ID_PATTERN = /^[\w-]{2,64}$/;
const YOUTUBE_HOST_PATTERN = /(^|\.)youtube\.com$|^youtu\.be$/;

export const isWatchLater = (listId) => listId === WATCH_LATER_ID;

// Watch later goes by its name in the manager's language. The title stored
// with it is the one the page showed, in the language of the YouTube account.
export const readSourceTitle = (listId, title) => (isWatchLater(listId) ? WATCH_LATER_TITLE : title || listId);

export const isListId = (value) => typeof value === 'string' && LIST_ID_PATTERN.test(value);

export const toPlaylistUrl = (listId) => `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;

// Reads a playlist ID from what the user pasted: a playlist address, a video
// address that carries `list=`, or the ID itself.
export const parsePlaylistInput = (text) => {
  const value = String(text ?? '').trim();

  if (!value) {
    return { error: t('playlist.error-empty') };
  }

  if (isListId(value)) {
    return { listId: value };
  }

  let url = null;

  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { error: t('playlist.error-invalid') };
  }

  if (!YOUTUBE_HOST_PATTERN.test(url.hostname)) {
    return { error: t('playlist.error-host') };
  }

  const listId = url.searchParams.get('list');

  if (!isListId(listId)) {
    return { error: t('playlist.error-no-id') };
  }

  return { listId };
};

// A file name part for a list: "wl" for Watch later, "playlist-<ID>" otherwise.
export const toFileSlug = (listId) => (isWatchLater(listId) ? 'wl' : `playlist-${listId}`);
