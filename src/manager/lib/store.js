// Everything the extension keeps lives in chrome.storage.local, on this
// computer, in this Chrome profile.
const KEYS = Object.freeze({
  snapshots: 'snapshots',
  activeListId: 'activeListId',
  settings: 'settings',
  categories: 'categories',
  pendingRemovals: 'pendingRemovals',
  viewPrefs: 'viewPrefs',
});

// Lets one open manager ignore the change events caused by its own writes
// while still following writes from another one (side panel and tab).
export const INSTANCE_ID = crypto.randomUUID();

export const STORAGE_KEYS = KEYS;

// Where version 1 kept its only list, Watch later.
const LEGACY_SNAPSHOT_KEY = 'snapshot';

export const loadAll = () => chrome.storage.local.get([...Object.values(KEYS), LEGACY_SNAPSHOT_KEY]);

export const removeLegacySnapshot = () => chrome.storage.local.remove(LEGACY_SNAPSHOT_KEY);

// Every scanned list, keyed by list ID, written in one piece.
export const saveSnapshots = (snapshots) => chrome.storage.local.set({
  [KEYS.snapshots]: { savedBy: INSTANCE_ID, lists: snapshots },
});

export const saveActiveListId = (listId) => chrome.storage.local.set({ [KEYS.activeListId]: listId });

export const saveSettings = (settings) => chrome.storage.local.set({ [KEYS.settings]: settings });

export const saveViewPrefs = (prefs) => chrome.storage.local.set({ [KEYS.viewPrefs]: prefs });

export const saveCategories = (categories) => chrome.storage.local.set({
  [KEYS.categories]: Object.fromEntries(categories),
});

// Videos removed during a job that has not finished yet. If the manager
// closes mid-job, the next start applies them to the stored list.
export const savePendingRemovals = (listId, videoIds) => chrome.storage.local.set({
  [KEYS.pendingRemovals]: { listId, videoIds: [...videoIds] },
});

export const clearPendingRemovals = () => chrome.storage.local.remove(KEYS.pendingRemovals);
