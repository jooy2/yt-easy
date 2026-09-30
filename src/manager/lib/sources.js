// The lists the manager can scan: Watch later, and any playlist the user
// names by its address or ID.
export const WATCH_LATER_ID = 'WL';
export const WATCH_LATER_TITLE = '나중에 볼 동영상';

const LIST_ID_PATTERN = /^[\w-]{2,64}$/;
const YOUTUBE_HOST_PATTERN = /(^|\.)youtube\.com$|^youtu\.be$/;

export const isWatchLater = (listId) => listId === WATCH_LATER_ID;

export const isListId = (value) => typeof value === 'string' && LIST_ID_PATTERN.test(value);

export const toPlaylistUrl = (listId) => `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;

// Reads a playlist ID from what the user pasted: a playlist address, a video
// address that carries `list=`, or the ID itself.
export const parsePlaylistInput = (text) => {
  const value = String(text ?? '').trim();

  if (!value) {
    return { error: '재생목록 주소나 ID를 입력해 주세요.' };
  }

  if (isListId(value)) {
    return { listId: value };
  }

  let url = null;

  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { error: '재생목록 주소나 ID를 알아볼 수 없습니다.' };
  }

  if (!YOUTUBE_HOST_PATTERN.test(url.hostname)) {
    return { error: 'YouTube 재생목록 주소만 쓸 수 있습니다.' };
  }

  const listId = url.searchParams.get('list');

  if (!isListId(listId)) {
    return { error: '주소에 재생목록 ID(list=…)가 없습니다.' };
  }

  return { listId };
};

// A file name part for a list: "wl" for Watch later, "playlist-<ID>" otherwise.
export const toFileSlug = (listId) => (isWatchLater(listId) ? 'wl' : `playlist-${listId}`);
