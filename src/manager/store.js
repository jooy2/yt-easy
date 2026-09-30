// Everything the extension keeps lives in chrome.storage.local, on this
// computer, in this Chrome profile.
const KEYS = Object.freeze({
  snapshot: 'snapshot',
  settings: 'settings',
  categories: 'categories',
  pendingRemovals: 'pendingRemovals',
  viewPrefs: 'viewPrefs',
});

// Lets one open manager ignore the change events caused by its own writes
// while still following writes from another one (side panel and tab).
export const INSTANCE_ID = crypto.randomUUID();

export const STORAGE_KEYS = KEYS;

export const loadAll = () => chrome.storage.local.get(Object.values(KEYS));

export const saveSnapshot = (snapshot) => chrome.storage.local.set({
  [KEYS.snapshot]: { ...snapshot, savedBy: INSTANCE_ID },
});

export const saveSettings = (settings) => chrome.storage.local.set({ [KEYS.settings]: settings });

export const saveViewPrefs = (prefs) => chrome.storage.local.set({ [KEYS.viewPrefs]: prefs });

export const saveCategories = (categories) => chrome.storage.local.set({
  [KEYS.categories]: Object.fromEntries(categories),
});

// Videos removed during a job that has not finished yet. If the manager
// closes mid-job, the next start applies them to the stored list.
export const savePendingRemovals = (videoIds) => chrome.storage.local.set({ [KEYS.pendingRemovals]: [...videoIds] });

export const clearPendingRemovals = () => chrome.storage.local.remove(KEYS.pendingRemovals);
