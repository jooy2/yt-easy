import { useCallback, useEffect, useState } from 'react';

import { normalizeSettings } from '../lib/settings.js';
import { isVideoId, readSnapshot, removeFromSnapshot } from '../lib/snapshot.js';
import * as store from '../lib/store.js';
import { normalizeViewPrefs } from '../lib/view-model.js';

const readCategories = (stored) => new Map(Object.entries(stored && typeof stored === 'object' ? stored : {})
  .filter(([videoId, categoryId]) => isVideoId(videoId) && typeof categoryId === 'string' && categoryId.length <= 4));

// Everything the manager keeps in chrome.storage.local, loaded once and kept
// in step with writes from another open manager (side panel and tab).
export const useManagerData = () => {
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [settings, setSettings] = useState(() => normalizeSettings(null));
  const [prefs, setPrefs] = useState(() => normalizeViewPrefs(null));
  const [categories, setCategories] = useState(() => new Map());

  useEffect(() => {
    let active = true;

    const load = async () => {
      const data = await store.loadAll();
      const pending = Array.isArray(data.pendingRemovals) ? data.pendingRemovals.filter(isVideoId) : [];
      let loaded = readSnapshot(data.snapshot);

      // Removals from a job whose manager closed before it could save them.
      if (pending.length > 0) {
        if (loaded) {
          loaded = removeFromSnapshot(loaded, new Set(pending));
          await store.saveSnapshot(loaded);
        }

        await store.clearPendingRemovals();
      }

      if (!active) {
        return;
      }

      setSnapshot(loaded);
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

      if (changes.snapshot && changes.snapshot.newValue?.savedBy !== store.INSTANCE_ID) {
        setSnapshot(readSnapshot(changes.snapshot.newValue));
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

  const saveSnapshot = useCallback(async (next) => {
    setSnapshot(next);
    await store.saveSnapshot(next);
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
    snapshot,
    settings,
    prefs,
    categories,
    saveSnapshot,
    saveSettings,
    saveCategories,
    setCategories,
    updatePrefs,
  };
};
