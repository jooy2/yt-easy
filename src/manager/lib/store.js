// Everything the extension keeps lives in chrome.storage.local, on this
// computer, in this Chrome profile.
const KEYS = Object.freeze({
  snapshots: 'snapshots',
  activeListId: 'activeListId',
  settings: 'settings',
  videoInfo: 'videoInfo',
  categoryNames: 'categoryNames',
  pendingRemovals: 'pendingRemovals',
  viewPrefs: 'viewPrefs',
});

// Lets one open manager ignore the change events caused by its own writes
// while still following writes from another one (side panel and tab).
export const INSTANCE_ID = crypto.randomUUID();

export const STORAGE_KEYS = KEYS;

// Where earlier versions kept their only list, Watch later, and the category
// of each video before publish dates and view counts were kept too.
const LEGACY_KEYS = Object.freeze({ snapshot: 'snapshot', categories: 'categories' });

export const loadAll = () => chrome.storage.local.get([...Object.values(KEYS), ...Object.values(LEGACY_KEYS)]);

export const removeLegacyData = () => chrome.storage.local.remove(Object.values(LEGACY_KEYS));

// Every scanned list, keyed by list ID, written in one piece.
export const saveSnapshots = (snapshots) => chrome.storage.local.set({
  [KEYS.snapshots]: { savedBy: INSTANCE_ID, lists: snapshots },
});

export const saveActiveListId = (listId) => chrome.storage.local.set({ [KEYS.activeListId]: listId });

export const saveSettings = (settings) => chrome.storage.local.set({ [KEYS.settings]: settings });

export const saveViewPrefs = (prefs) => chrome.storage.local.set({ [KEYS.viewPrefs]: prefs });

export const saveVideoInfo = (info) => chrome.storage.local.set({ [KEYS.videoInfo]: Object.fromEntries(info) });

export const saveCategoryNames = (names) => chrome.storage.local.set({ [KEYS.categoryNames]: Object.fromEntries(names) });

// Videos removed during a job that has not finished yet. If the manager
// closes mid-job, the next start applies them to the stored list.
export const savePendingRemovals = (listId, videoIds) => chrome.storage.local.set({
  [KEYS.pendingRemovals]: { listId, videoIds: [...videoIds] },
});

export const clearPendingRemovals = () => chrome.storage.local.remove(KEYS.pendingRemovals);
