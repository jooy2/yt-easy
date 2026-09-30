import { useCallback, useEffect, useRef, useState } from 'react';

import { normalizeSettings } from '../lib/settings.js';
import { isVideoId, pruneSnapshots, readSnapshot, removeFromSnapshot } from '../lib/snapshot.js';
import { WATCH_LATER_ID, isListId, isWatchLater } from '../lib/sources.js';
import * as store from '../lib/store.js';
import { normalizeViewPrefs } from '../lib/view-model.js';

const readCategories = (stored) => new Map(Object.entries(stored && typeof stored === 'object' ? stored : {})
  .filter(([videoId, categoryId]) => isVideoId(videoId) && typeof categoryId === 'string' && categoryId.length <= 4));

const readSnapshots = (stored) => {
  const lists = stored?.lists && typeof stored.lists === 'object' ? stored.lists : {};
  const result = {};

  for (const value of Object.values(lists)) {
    const snapshot = readSnapshot(value);

    if (snapshot) {
      result[snapshot.listId] = snapshot;
    }
  }

  return result;
};

// Version 1 stored pending removals as a bare array of Watch later IDs.
const readPendingRemovals = (stored) => {
  const entry = Array.isArray(stored) ? { listId: WATCH_LATER_ID, videoIds: stored } : stored;

  if (!entry || !isListId(entry.listId) || !Array.isArray(entry.videoIds)) {
    return null;
  }

  return { listId: entry.listId, videoIds: entry.videoIds.filter(isVideoId) };
};

// Everything the manager keeps in chrome.storage.local, loaded once and kept
// in step with writes from another open manager (side panel and tab). Each
// scanned list is kept on its own, and one of them is shown at a time.
export const useManagerData = () => {
  const [ready, setReady] = useState(false);
  const [snapshots, setSnapshots] = useState({});
  const [activeListId, setActiveListIdState] = useState(WATCH_LATER_ID);
  const [settings, setSettings] = useState(() => normalizeSettings(null));
  const [prefs, setPrefs] = useState(() => normalizeViewPrefs(null));
  const [categories, setCategories] = useState(() => new Map());
  const snapshotsRef = useRef(snapshots);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await store.loadAll();
      const pending = readPendingRemovals(data.pendingRemovals);
      const legacy = readSnapshot(data.snapshot);
      let lists = readSnapshots(data.snapshots);
      let changed = false;

      if (legacy && !lists[legacy.listId]) {
        lists = { ...lists, [legacy.listId]: legacy };
        changed = true;
      }

      // Removals from a job whose manager closed before it could save them.
      if (pending && lists[pending.listId] && pending.videoIds.length > 0) {
        lists = { ...lists, [pending.listId]: removeFromSnapshot(lists[pending.listId], new Set(pending.videoIds)) };
        changed = true;
      }

      if (changed) {
        await store.saveSnapshots(lists);
      }

      if (data.snapshot !== undefined) {
        await store.removeLegacySnapshot();
      }

      if (data.pendingRemovals !== undefined) {
        await store.clearPendingRemovals();
      }

      if (!active) {
        return;
      }

      const listId = isListId(data.activeListId) && (lists[data.activeListId] || isWatchLater(data.activeListId))
        ? data.activeListId
        : WATCH_LATER_ID;

      snapshotsRef.current = lists;
      setSnapshots(lists);
      setActiveListIdState(listId);
      setSettings(normalizeSettings(data.settings));
      setPrefs(normalizeViewPrefs(data.viewPrefs));
      setCategories(readCategories(data.categories));
      setReady(true);
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onChanged = (changes, area) => {
      if (area !== 'local') {
        return;
      }

      if (changes.snapshots && changes.snapshots.newValue?.savedBy !== store.INSTANCE_ID) {
        const lists = readSnapshots(changes.snapshots.newValue);

        snapshotsRef.current = lists;
        setSnapshots(lists);
      }

      if (changes.settings) {
        setSettings(normalizeSettings(changes.settings.newValue));
      }

      if (changes.categories) {
        setCategories(readCategories(changes.categories.newValue));
      }
    };

    chrome.storage.onChanged.addListener(onChanged);

    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  // View preferences are remembered as they change.
  useEffect(() => {
    if (ready) {
      store.saveViewPrefs(prefs).catch(() => {});
    }
  }, [prefs, ready]);

  const writeSnapshots = useCallback(async (lists) => {
    snapshotsRef.current = lists;
    setSnapshots(lists);
    await store.saveSnapshots(lists);

    return lists;
  }, []);

  // Stores a scanned list, dropping the oldest others when there are too
  // many. Resolves with every list kept.
  const saveSnapshot = useCallback(
    (next) => writeSnapshots(pruneSnapshots({ ...snapshotsRef.current, [next.listId]: next }, next.listId)),
    [writeSnapshots],
  );

  const forgetSnapshot = useCallback((listId) => {
    const { [listId]: forgotten, ...rest } = snapshotsRef.current;

    return forgotten ? writeSnapshots(rest) : Promise.resolve(rest);
  }, [writeSnapshots]);

  const setActiveListId = useCallback((listId) => {
    setActiveListIdState(listId);
    store.saveActiveListId(listId).catch(() => {});
  }, []);

  const saveSettings = useCallback(async (next) => {
    setSettings(next);
    await store.saveSettings(next);
  }, []);

  const saveCategories = useCallback(async (next) => {
    setCategories(next);
    await store.saveCategories(next);
  }, []);

  const updatePrefs = useCallback((patch) => {
    setPrefs((current) => ({ ...current, ...patch }));
  }, []);

  return {
    ready,
    snapshots,
    snapshot: snapshots[activeListId] ?? null,
    activeListId,
    setActiveListId,
    saveSnapshot,
    forgetSnapshot,
    settings,
    prefs,
    categories,
    saveSettings,
    saveCategories,
    setCategories,
    updatePrefs,
  };
};
