import { Pane, Panes, useToast } from 'neba';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { locale, t } from '../i18n/runtime.js';

import { AddPlaylistDialog } from './components/AddPlaylistDialog.jsx';
import { AppHeader } from './components/AppHeader.jsx';
import { EmptyState } from './components/EmptyState.jsx';
import { FilterBar } from './components/FilterBar.jsx';
import { ALL_GROUP_KEY, GroupRail } from './components/GroupRail.jsx';
import { ListHeader } from './components/ListHeader.jsx';
import { RemoveDialog } from './components/RemoveDialog.jsx';
import { ResultDialog } from './components/ResultDialog.jsx';
import { SelectionBar } from './components/SelectionBar.jsx';
import { SettingsDialog } from './components/SettingsDialog.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { VideoRow } from './components/VideoRow.jsx';
import { VirtualList } from './components/VirtualList.jsx';
import { useManagerData } from './hooks/useManagerData.js';
import { useTask } from './hooks/useTask.js';
import { buildCsv, buildFileName, buildJson, downloadText } from './lib/export.js';
import { formatDate, formatDateTime, formatFileStamp, formatViews } from './lib/format.js';
import { openInCurrentTab, openInNewTab } from './lib/open-video.js';
import { addAll, readCoverage, removeAll, selectRange, toggleOne } from './lib/selection.js';
import { createSnapshot, removeFromSnapshot } from './lib/snapshot.js';
import { WATCH_LATER_ID, WATCH_LATER_TITLE, isWatchLater, readSourceTitle, toFileSlug } from './lib/sources.js';
import * as store from './lib/store.js';
import { prepareListTab, runJob } from './lib/tab-bridge.js';
import { fetchCategoryNames, fetchVideoInfo, removeApiPermission, requestApiPermission } from './lib/video-info.js';
import {
  INFO_SORTS,
  buildSearchText,
  buildView,
  createBuckets,
  listCategories,
  readCategoryId,
  readCategoryName,
  readGrouping,
} from './lib/view-model.js';

const IS_TAB_VIEW = new URLSearchParams(location.search).get('view') === 'tab';
const ITEM_ROW_HEIGHT = 72;
const PENDING_SAVE_INTERVAL = 10;
const NO_ITEMS = [];

const isAbortError = (error) => error?.name === 'AbortError';

const isLookedUp = (info, videoId) => (info.get(videoId)?.t ?? 0) > 0;

// Keys typed into a field, or inside a popup, belong to that control.
const isOwnedByControl = (target) => Boolean(target?.closest?.(
  'input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="listbox"], [role="menu"], [role="dialog"]',
));

const getRowHeight = () => ITEM_ROW_HEIGHT;

const describeScanProgress = ({ count, paused }) => t(paused ? 'scan.paused' : 'scan.progress', { count });

export function App() {
  const data = useManagerData();
  const { snapshot, snapshots, activeListId, settings, prefs, videoInfo, categoryNames } = data;
  const { task, start, update, end, cancel } = useTask();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [activeGroup, setActiveGroup] = useState(ALL_GROUP_KEY);
  // Reasons for videos whose last removal failed, shown on their rows.
  const [failures, setFailures] = useState(() => new Map());
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState(null);
  const [result, setResult] = useState(null);

  const deferredQuery = useDeferredValue(query);
  const items = snapshot?.items ?? NO_ITEMS;
  const sourceTitle = readSourceTitle(activeListId, snapshot?.title);
  // Watch later always has a remove entry. Another playlist has one only
  // when it is the user's own, which the scan shows by finding its label.
  const canRemove = isWatchLater(activeListId) || Boolean(snapshot?.removeLabel);
  const busy = task !== null;
  const hasApiKey = Boolean(settings.apiKey);
  // Sorts that need the Data API fall back to list order without a key.
  const sortBy = !hasApiKey && INFO_SORTS.includes(prefs.sortBy) ? 'position' : prefs.sortBy;
  const buckets = useMemo(() => createBuckets(settings.durationBounds), [settings.durationBounds]);
  const durationFilter = buckets.some((bucket) => bucket.key === prefs.durationFilter) ? prefs.durationFilter : 'all';
  const searchTexts = useMemo(() => new Map(items.map((item) => [item.videoId, buildSearchText(item)])), [items]);

  const view = useMemo(() => buildView({
    items,
    searchTexts,
    query: deferredQuery,
    durationFilter,
    categoryFilter: hasApiKey ? prefs.categoryFilter : 'all',
    watchFilter: prefs.watchFilter,
    info: videoInfo,
    names: categoryNames,
    buckets,
    groupOrder: prefs.groupOrder,
    sortBy,
    sortDir: prefs.sortDir,
  }), [items, searchTexts, deferredQuery, durationFilter, hasApiKey, prefs, sortBy, videoInfo, categoryNames, buckets]);

  const missingInfoCount = useMemo(() => items.filter((item) => !isLookedUp(videoInfo, item.videoId)).length, [items, videoInfo]);
  const categoryOptions = useMemo(() => listCategories(items, videoInfo, categoryNames), [items, videoInfo, categoryNames]);

  // With grouping, the list shows the group chosen in the rail. A group that
  // a filter emptied falls back to all videos.
  const activeGroupEntry = view.groups.find((group) => group.key === activeGroup) ?? null;
  const shownItems = activeGroupEntry ? activeGroupEntry.items : view.items;
  const shownIds = useMemo(() => shownItems.map((item) => item.videoId), [shownItems]);
  const shownRows = useMemo(() => shownItems.map((item) => ({ key: item.videoId, item })), [shownItems]);
  const shownSeconds = useMemo(() => shownItems.reduce((sum, item) => sum + (item.durationSeconds ?? 0), 0), [shownItems]);
  const filtersActive = query.trim() !== ''
    || durationFilter !== 'all'
    || prefs.watchFilter !== 'all'
    || (hasApiKey && prefs.categoryFilter !== 'all');

  // A new grouping starts from all videos.
  useEffect(() => {
    setActiveGroup(ALL_GROUP_KEY);
  }, [sortBy]);

  // Another list starts with nothing selected.
  useEffect(() => {
    setSelected(new Set());
    setFailures(new Map());
    setActiveGroup(ALL_GROUP_KEY);
  }, [activeListId]);

  // The lists for the menu: Watch later first, even before its first scan,
  // then the other scanned lists, newest first.
  const sources = useMemo(() => {
    const entries = Object.values(snapshots).sort((a, b) => {
      if (isWatchLater(a.listId) !== isWatchLater(b.listId)) {
        return isWatchLater(a.listId) ? -1 : 1;
      }

      return b.collectedAt - a.collectedAt;
    });
    const list = entries.map((entry) => ({
      listId: entry.listId,
      title: readSourceTitle(entry.listId, entry.title),
      description: t('source.description', { count: entry.items.length, time: formatDateTime(entry.collectedAt) }),
    }));

    if (!snapshots[WATCH_LATER_ID]) {
      list.unshift({ listId: WATCH_LATER_ID, title: WATCH_LATER_TITLE, description: t('source.not-scanned') });
    }

    return list;
  }, [snapshots]);

  // Keep the selection and the failure marks to videos that still exist.
  useEffect(() => {
    const ids = new Set(items.map((item) => item.videoId));

    setSelected((current) => {
      const next = new Set([...current].filter((videoId) => ids.has(videoId)));

      return next.size === current.size ? current : next;
    });
    setFailures((current) => {
      const next = new Map([...current].filter(([videoId]) => ids.has(videoId)));

      return next.size === current.size ? current : next;
    });
  }, [items]);

  // Closing a tab mid-removal would cancel it; ask first.
  useEffect(() => {
    if (task?.kind !== 'remove') {
      return undefined;
    }

    const onBeforeUnload = (event) => event.preventDefault();

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [task?.kind]);

  const announce = useCallback((title) => {
    toast.add({ title, color: 'success', timeout: 4000 });
  }, [toast]);

  const saveList = useCallback(({ items: list, suffix, stamp, format, kind }) => {
    const isJson = format === 'json';

    return downloadText({
      filename: buildFileName({ prefix: `${toFileSlug(activeListId)}-${suffix}`, stamp, extension: format }),
      text: isJson
        ? buildJson({ items: list, info: videoInfo, names: categoryNames, kind, exportedAt: Date.now(), listId: activeListId, listTitle: sourceTitle })
        : buildCsv(list, { info: videoInfo, names: categoryNames }),
      type: isJson ? 'application/json' : 'text/csv',
    });
  }, [videoInfo, categoryNames, activeListId, sourceTitle]);

  // -------------------------------------------------------------------------
  // Scanning

  // Scans a list and, once it succeeds, shows it. A failed scan of a new
  // playlist leaves the current list on screen.
  const scanList = async (listId) => {
    const controller = start({ kind: 'scan', label: t('common.preparing-tab') });
    const onProgress = (progress) => update({ label: describeScanProgress(progress) });

    setMessage('');

    try {
      let { tab } = await prepareListTab({ listId, activate: false });
      let collected = null;

      update({ label: t('scan.running') });

      try {
        collected = await runJob({ tabId: tab.id, command: { type: 'collect', listId, mode: 'auto' }, signal: controller.signal, onProgress });
      } catch (error) {
        if (error.code !== 'needs-dom') {
          throw error;
        }

        // Scrolling only works in a visible tab, so the tab comes to the front.
        update({ label: t('scan.retry-dom') });
        ({ tab } = await prepareListTab({ listId, activate: true }));
        collected = await runJob({ tabId: tab.id, command: { type: 'collect', listId, mode: 'dom' }, signal: controller.signal, onProgress });
      }

      const next = createSnapshot({ ...collected, listId, collectedAt: Date.now() });
      const lists = await data.saveSnapshot(next);
      const ids = new Set(Object.values(lists).flatMap((entry) => entry.items.map((item) => item.videoId)));

      data.setActiveListId(listId);
      await store.clearPendingRemovals();
      setFailures(new Map());

      // Drop video info of videos that are in none of the kept lists.
      const kept = new Map([...videoInfo].filter(([videoId]) => ids.has(videoId)));

      if (kept.size !== videoInfo.size) {
        await data.saveVideoInfo(kept);
      }

      announce(t('scan.done', { title: readSourceTitle(listId, next.title), count: next.items.length }));
    } catch (error) {
      if (isAbortError(error)) {
        announce(t('scan.cancelled'));
      } else {
        setMessage(error.message);
      }
    } finally {
      end();
    }
  };

  const handleScan = () => scanList(activeListId);

  const handleForgetSource = async () => {
    if (isWatchLater(activeListId)) {
      return;
    }

    const title = sourceTitle;

    await data.forgetSnapshot(activeListId);
    data.setActiveListId(WATCH_LATER_ID);
    announce(t('source.forgotten', { title }));
  };

  // -------------------------------------------------------------------------
  // Export

  const handleExport = async (format) => {
    if (items.length === 0) {
      return;
    }

    start({ kind: 'export', label: t('export.saving'), cancellable: false });
    setMessage('');

    try {
      await saveList({ items, suffix: 'export', stamp: formatFileStamp(new Date()), format, kind: 'export' });
      announce(t('export.done', { count: items.length, format: format.toUpperCase() }));
    } catch (error) {
      setMessage(error.message);
    } finally {
      end();
    }
  };

  // -------------------------------------------------------------------------
  // Video info from the Data API

  // Looks up the videos not looked up yet. When every video already is, it
  // looks all of them up again, which brings the view counts up to date.
  const handleFetchInfo = async () => {
    if (!hasApiKey || items.length === 0) {
      return;
    }

    // Asked first, inside the click: Chrome shows the prompt only during a
    // user gesture, and resolves at once when the permission is already held.
    const granted = await requestApiPermission().catch(() => false);

    if (!granted) {
      setMessage(t('info.permission-needed'));
      return;
    }

    const refreshing = missingInfoCount === 0;
    const targets = items.map((item) => item.videoId).filter((videoId) => refreshing || !isLookedUp(videoInfo, videoId));
    const progressKey = refreshing ? 'info.refreshing' : 'info.fetching';
    const controller = start({ kind: 'info', label: t(progressKey, { done: 0, total: targets.length }) });
    const found = new Map(videoInfo);

    setMessage('');
    update({ value: 0, max: targets.length });

    try {
      if (categoryNames.size === 0) {
        await data.saveCategoryNames(await fetchCategoryNames({ apiKey: settings.apiKey, signal: controller.signal }));
      }

      await fetchVideoInfo({
        apiKey: settings.apiKey,
        videoIds: targets,
        signal: controller.signal,
        onBatch: (entries, { done, total }) => {
          for (const [videoId, entry] of entries) {
            found.set(videoId, entry);
          }

          data.setVideoInfo(new Map(found));
          update({ label: t(progressKey, { done, total }), value: done, max: total });
        },
      });
      announce(t(refreshing ? 'info.refreshed' : 'info.fetched'));
    } catch (error) {
      if (!isAbortError(error)) {
        setMessage(error.message);
      }
    } finally {
      await data.saveVideoInfo(found);
      end();
    }
  };

  // -------------------------------------------------------------------------
  // Settings

  const handleSaveSettings = async (next) => {
    const keyChanged = next.apiKey !== settings.apiKey;

    if (keyChanged && next.apiKey) {
      const granted = await requestApiPermission().catch(() => false);

      if (!granted) {
        return t('settings.key-not-saved');
      }
    }

    if (keyChanged && !next.apiKey) {
      await removeApiPermission().catch(() => false);
    }

    await data.saveSettings(next);
    announce(t('settings.saved'));

    return null;
  };

  // -------------------------------------------------------------------------
  // Removal

  const selectedItems = useMemo(() => items.filter((item) => selected.has(item.videoId)), [items, selected]);

  const applyRemovals = async (removedIds) => {
    if (!snapshot) {
      return;
    }

    await data.saveSnapshot(removeFromSnapshot(snapshot, removedIds));
    await store.clearPendingRemovals();
    setSelected((current) => removeAll(current, removedIds));
  };

  const runRemoval = async ({ targets, dryRun, backup }) => {
    const controller = start({ kind: 'remove', label: t(backup ? 'remove.backing-up' : 'common.preparing-tab') });
    const removed = new Set();
    let currentTitle = '';
    let outcome = null;

    setDialog(null);
    setMessage('');

    try {
      if (backup) {
        const stamp = formatFileStamp(new Date());

        await saveList({ items: targets, suffix: 'delete-backup', stamp, format: 'json', kind: 'delete-backup' });
        await saveList({ items: targets, suffix: 'delete-backup', stamp, format: 'csv', kind: 'delete-backup' });
        update({ label: t('common.preparing-tab') });
      }

      const { tab } = await prepareListTab({ listId: activeListId, activate: true });

      update({ label: t(dryRun ? 'remove.preparing-dry' : 'remove.preparing', { done: 0, total: targets.length }), value: 0, max: targets.length });

      outcome = await runJob({
        tabId: tab.id,
        command: {
          type: 'remove',
          targets: targets.map(({ videoId, title }) => ({ videoId, title })),
          options: {
            listId: activeListId,
            listTitle: sourceTitle,
            delayMin: settings.removeDelayMin * 1000,
            delayMax: settings.removeDelayMax * 1000,
            dryRun,
            removeLabels: snapshot?.removeLabel ? [snapshot.removeLabel] : [],
          },
        },
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.result?.ok && !dryRun) {
            removed.add(progress.result.videoId);

            // Saved every few removals rather than after each one, so a long
            // job does not rewrite a growing list thousands of times. The
            // finally block below applies all of them.
            if (removed.size % PENDING_SAVE_INTERVAL === 0) {
              store.savePendingRemovals(activeListId, removed).catch(() => {});
            }
          }

          if (progress.current) {
            currentTitle = progress.current.title;
          }

          update({
            label: progress.paused
              ? t('remove.paused')
              : t(dryRun ? 'remove.progress-dry' : 'remove.progress', { done: progress.done, total: progress.total, title: currentTitle }),
            value: progress.done,
            max: progress.total,
          });
        },
      });
    } catch (error) {
      if (!isAbortError(error)) {
        setMessage(error.message);
      }
    } finally {
      if (removed.size > 0) {
        await applyRemovals(removed);
      }

      end();
    }

    if (outcome) {
      if (!dryRun) {
        setFailures((current) => {
          const next = new Map(current);

          for (const entry of outcome.results) {
            if (!entry.ok) {
              next.set(entry.videoId, entry.reason);
            }
          }

          return next;
        });
      }

      setResult({ outcome, targets, dryRun });
    }
  };

  // -------------------------------------------------------------------------
  // Rows

  // The latest shown list and the anchor of the last plain click, read by
  // the stable handlers below so the rows do not re-render on every change.
  const shownIdsRef = useRef(shownIds);
  const anchorRef = useRef(null);
  const dialogOpenRef = useRef(false);

  shownIdsRef.current = shownIds;
  dialogOpenRef.current = dialog !== null || result !== null;

  const handleSelect = useCallback((videoId, { range }) => {
    const anchorId = anchorRef.current;

    if (range && anchorId && shownIdsRef.current.includes(anchorId)) {
      setSelected((current) => selectRange({ selected: current, videoIds: shownIdsRef.current, anchorId, targetId: videoId }));
      return;
    }

    anchorRef.current = videoId;
    setSelected((current) => toggleOne(current, videoId));
  }, []);

  // Ctrl+A (⌘+A on a Mac) selects every video shown, and Escape clears the
  // selection, unless a field or a popup has the keyboard.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (dialogOpenRef.current || isOwnedByControl(event.target)) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelected((current) => addAll(current, shownIdsRef.current));
      } else if (event.key === 'Escape') {
        setSelected((current) => (current.size > 0 ? new Set() : current));
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpen = useCallback((videoId) => {
    openInCurrentTab(videoId).catch(() => setMessage(t('row.open-error')));
  }, []);

  const handleOpenNewTab = useCallback((videoId) => {
    openInNewTab(videoId).catch(() => setMessage(t('row.open-error')));
  }, []);

  const handleToggleShown = (checked) => {
    setSelected((current) => (checked ? addAll(current, shownIds) : removeAll(current, shownIds)));
  };

  const renderRow = (row, layout) => {
    const entry = videoInfo.get(row.item.videoId);
    const categoryId = readCategoryId(row.item, videoInfo);
    let extra = null;

    // The row shows the date or the views only while the list is sorted by it.
    if (sortBy === 'published' && entry?.p) {
      extra = formatDate(entry.p);
    } else if (sortBy === 'views' && entry?.v != null) {
      extra = formatViews(entry.v);
    }

    return (
      <VideoRow
        key={row.key}
        item={row.item}
        {...layout}
        selected={selected.has(row.item.videoId)}
        failure={failures.get(row.item.videoId)}
        categoryName={categoryId ? readCategoryName(categoryId, categoryNames) : null}
        extra={extra}
        // Loading a video into the current tab could replace the playlist
        // tab a running job works in.
        openDisabled={busy}
        onSelect={handleSelect}
        onOpen={handleOpen}
        onOpenNewTab={handleOpenNewTab}
      />
    );
  };

  // -------------------------------------------------------------------------
  // Layout

  const summary = useMemo(() => {
    if (!snapshot) {
      return '';
    }

    const parts = [t('status.total', { count: items.length })];

    if (view.items.length !== items.length) {
      parts.push(t('status.shown', { count: view.items.length }));
    }

    parts.push(t('status.scanned', { time: formatDateTime(snapshot.collectedAt) }));

    if (snapshot.method === 'dom') {
      parts.push(t('status.by-scrolling'));
    }

    return parts.join(' · ');
  }, [snapshot, items.length, view.items.length]);

  const infoNote = useMemo(() => {
    if (!hasApiKey) {
      return t('note.info-no-key');
    }

    if (items.length === 0) {
      return '';
    }

    const times = items.map((item) => videoInfo.get(item.videoId)?.t ?? 0).filter((time) => time > 0);
    const parts = [t('note.info-coverage', { found: items.length - missingInfoCount, total: items.length })];

    if (times.length > 0) {
      parts.push(t('note.info-views-since', { time: formatDateTime(Math.min(...times)) }));
    }

    if (missingInfoCount > 0) {
      parts.push(t('note.info-missing'));
    }

    return parts.join(' ');
  }, [hasApiKey, items, videoInfo, missingInfoCount]);

  let emptyReason = null;

  if (!snapshot) {
    emptyReason = 'none';
  } else if (items.length === 0) {
    emptyReason = 'empty';
  } else if (view.items.length === 0) {
    emptyReason = 'filtered';
  }

  const grouping = readGrouping(sortBy);
  const grouped = grouping !== 'none';
  const listTitle = activeGroupEntry?.label ?? t(grouped ? 'list.group-all' : 'list.whole');
  const listPane = (
    <div className="list-pane">
      <ListHeader
        title={listTitle}
        count={shownItems.length}
        totalSeconds={shownSeconds}
        coverage={readCoverage(selected, shownIds)}
        onToggleAll={handleToggleShown}
      />
      {emptyReason === 'filtered' ? (
        <EmptyState reason="filtered" />
      ) : (
        <VirtualList
          className="video-list"
          label={t('list.aria-label', { title: listTitle })}
          rows={shownRows}
          getHeight={getRowHeight}
          renderRow={renderRow}
          resetKey={`${deferredQuery}|${durationFilter}|${prefs.categoryFilter}|${prefs.watchFilter}|${sortBy}|${prefs.sortDir}|${prefs.groupOrder}|${activeGroup}`}
        />
      )}
    </div>
  );

  if (!data.ready) {
    return null;
  }

  return (
    <div className="app">
      <AppHeader
        isTabView={IS_TAB_VIEW}
        busy={busy}
        hasItems={items.length > 0}
        sources={sources}
        activeListId={activeListId}
        sourceTitle={sourceTitle}
        canForget={!isWatchLater(activeListId) && Boolean(snapshot)}
        onSelectSource={data.setActiveListId}
        onAddPlaylist={() => setDialog('add-playlist')}
        onForgetSource={handleForgetSource}
        filtersOpen={prefs.filtersOpen}
        filtersActive={filtersActive}
        onToggleFilters={() => data.updatePrefs({ filtersOpen: !prefs.filtersOpen })}
        onScan={handleScan}
        onExport={handleExport}
        onOpenSettings={() => setDialog('settings')}
        onOpenInTab={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/manager.html?view=tab') })}
      />
      {snapshot && (
        <FilterBar
          open={prefs.filtersOpen}
          query={query}
          onQueryChange={setQuery}
          prefs={prefs}
          durationFilter={durationFilter}
          onPrefsChange={data.updatePrefs}
          buckets={buckets}
          hasApiKey={hasApiKey}
          sortBy={sortBy}
          categoryOptions={categoryOptions}
          categoryNames={categoryNames}
          canFetchInfo={hasApiKey && !busy && items.length > 0}
          infoRefresh={missingInfoCount === 0}
          infoNote={infoNote}
          onFetchInfo={handleFetchInfo}
        />
      )}
      <StatusBar summary={summary} task={task} onCancel={cancel} message={message} onDismissMessage={() => setMessage('')} />
      {snapshot && (
        <SelectionBar
          selectedCount={selected.size}
          totalCount={items.length}
          busy={busy}
          canRemove={canRemove}
          onSelectAll={() => setSelected(new Set(items.map((item) => item.videoId)))}
          onClear={() => setSelected(new Set())}
          onRemove={() => setDialog('remove')}
        />
      )}
      <main className="list-area">
        {emptyReason === 'none' || emptyReason === 'empty' ? (
          <EmptyState reason={emptyReason} busy={busy} listTitle={sourceTitle} onScan={handleScan} />
        ) : grouped ? (
          <Panes className="group-panes" resizable handleLabel={t('list.resize-handle')} locale={locale}>
            {/* neba reads a bare number as a percentage, so pixel limits are strings. */}
            <Pane defaultSize="34%" minSize="110px" maxSize="60%">
              <GroupRail
                grouping={grouping}
                groupOrder={prefs.groupOrder}
                onGroupOrderChange={(groupOrder) => data.updatePrefs({ groupOrder })}
                groups={view.groups}
                totalCount={view.items.length}
                activeKey={activeGroupEntry ? activeGroup : ALL_GROUP_KEY}
                onSelect={setActiveGroup}
              />
            </Pane>
            <Pane minSize="180px">{listPane}</Pane>
          </Panes>
        ) : (
          listPane
        )}
      </main>
      <SettingsDialog open={dialog === 'settings'} settings={settings} onClose={() => setDialog(null)} onSave={handleSaveSettings} />
      <RemoveDialog
        open={dialog === 'remove'}
        items={selectedItems}
        listTitle={sourceTitle}
        defaultTestCount={settings.testModeCount}
        onClose={() => setDialog(null)}
        onConfirm={runRemoval}
      />
      <AddPlaylistDialog
        open={dialog === 'add-playlist'}
        onClose={() => setDialog(null)}
        onSubmit={(listId) => {
          setDialog(null);
          scanList(listId);
        }}
      />
      <ResultDialog
        result={result}
        onClose={() => setResult(null)}
        onSelectFailed={(videoIds) => {
          const ids = new Set(items.map((item) => item.videoId));

          setSelected(new Set(videoIds.filter((videoId) => ids.has(videoId))));
          setResult(null);
        }}
      />
    </div>
  );
}
