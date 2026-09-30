import { useToast } from 'neba';
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';

import { AppHeader } from './components/AppHeader.jsx';
import { EmptyState } from './components/EmptyState.jsx';
import { FilterBar } from './components/FilterBar.jsx';
import { GroupRow } from './components/GroupRow.jsx';
import { RemoveDialog } from './components/RemoveDialog.jsx';
import { ResultDialog } from './components/ResultDialog.jsx';
import { SelectionBar } from './components/SelectionBar.jsx';
import { SettingsDialog } from './components/SettingsDialog.jsx';
import { StatusBar } from './components/StatusBar.jsx';
import { VideoRow } from './components/VideoRow.jsx';
import { VirtualList } from './components/VirtualList.jsx';
import { useManagerData } from './hooks/useManagerData.js';
import { useTask } from './hooks/useTask.js';
import { fetchCategories, removeApiPermission, requestApiPermission } from './lib/categories.js';
import { buildCsv, buildFileName, buildJson, downloadText } from './lib/export.js';
import { formatCount, formatDateTime, formatFileStamp } from './lib/format.js';
import { addAll, readCoverage, removeAll, toggleOne } from './lib/selection.js';
import { createSnapshot, removeFromSnapshot } from './lib/snapshot.js';
import * as store from './lib/store.js';
import { prepareWatchLaterTab, runJob } from './lib/tab-bridge.js';
import { MUSIC_CATEGORY_ID, buildSearchText, buildView, createBuckets } from './lib/view-model.js';

const IS_TAB_VIEW = new URLSearchParams(location.search).get('view') === 'tab';
const ITEM_ROW_HEIGHT = 72;
const GROUP_ROW_HEIGHT = 44;
const PENDING_SAVE_INTERVAL = 10;
const NO_ITEMS = [];

const isAbortError = (error) => error?.name === 'AbortError';

const getRowHeight = (row) => (row.type === 'group' ? GROUP_ROW_HEIGHT : ITEM_ROW_HEIGHT);

const describeScanProgress = ({ count, paused }) => (paused
  ? `${formatCount(count)}개까지 읽었습니다. YouTube 탭이 화면에 보이면 이어서 진행합니다.`
  : `${formatCount(count)}개 수집 중…`);

export function App() {
  const data = useManagerData();
  const { snapshot, settings, prefs, categories } = data;
  const { task, start, update, end, cancel } = useTask();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [collapsed, setCollapsed] = useState(() => new Set());
  // Reasons for videos whose last removal failed, shown on their rows.
  const [failures, setFailures] = useState(() => new Map());
  const [message, setMessage] = useState('');
  const [dialog, setDialog] = useState(null);
  const [result, setResult] = useState(null);

  const deferredQuery = useDeferredValue(query);
  const items = snapshot?.items ?? NO_ITEMS;
  const busy = task !== null;
  const hasApiKey = Boolean(settings.apiKey);
  const buckets = useMemo(() => createBuckets(settings.durationBounds), [settings.durationBounds]);
  const durationFilter = buckets.some((bucket) => bucket.key === prefs.durationFilter) ? prefs.durationFilter : 'all';
  const searchTexts = useMemo(() => new Map(items.map((item) => [item.videoId, buildSearchText(item)])), [items]);

  const view = useMemo(() => buildView({
    items,
    searchTexts,
    query: deferredQuery,
    durationFilter,
    categoryFilter: hasApiKey ? prefs.categoryFilter : 'all',
    categories,
    buckets,
    groupBy: prefs.groupBy,
    sortBy: prefs.sortBy,
    sortDir: prefs.sortDir,
    collapsed,
  }), [items, searchTexts, deferredQuery, durationFilter, hasApiKey, prefs, categories, buckets, collapsed]);

  const viewIds = useMemo(() => view.items.map((item) => item.videoId), [view.items]);

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

  const saveList = useCallback(({ items: list, prefix, stamp, format, kind }) => {
    const isJson = format === 'json';

    return downloadText({
      filename: buildFileName({ prefix, stamp, extension: format }),
      text: isJson ? buildJson({ items: list, categories, kind, exportedAt: Date.now() }) : buildCsv(list, categories),
      type: isJson ? 'application/json' : 'text/csv',
    });
  }, [categories]);

  // -------------------------------------------------------------------------
  // Scanning

  const handleScan = async () => {
    const controller = start({ kind: 'scan', label: 'YouTube 탭을 준비하는 중…' });
    const onProgress = (progress) => update({ label: describeScanProgress(progress) });

    setMessage('');

    try {
      let { tab } = await prepareWatchLaterTab({ activate: false });
      let collected = null;

      update({ label: '목록을 수집하는 중…' });

      try {
        collected = await runJob({ tabId: tab.id, command: { type: 'collect', mode: 'auto' }, signal: controller.signal, onProgress });
      } catch (error) {
        if (error.code !== 'needs-dom') {
          throw error;
        }

        // Scrolling only works in a visible tab, so the tab comes to the front.
        update({ label: '페이지 데이터로 읽지 못해 스크롤 방식으로 다시 수집합니다…' });
        ({ tab } = await prepareWatchLaterTab({ activate: true }));
        collected = await runJob({ tabId: tab.id, command: { type: 'collect', mode: 'dom' }, signal: controller.signal, onProgress });
      }

      const next = createSnapshot({ ...collected, collectedAt: Date.now() });
      const ids = new Set(next.items.map((item) => item.videoId));

      await data.saveSnapshot(next);
      await store.clearPendingRemovals();
      setFailures(new Map());

      // Drop category entries of videos that are no longer in the list.
      const kept = new Map([...categories].filter(([videoId]) => ids.has(videoId)));

      if (kept.size !== categories.size) {
        await data.saveCategories(kept);
      }

      announce(`${formatCount(next.items.length)}개를 수집했습니다.`);
    } catch (error) {
      if (isAbortError(error)) {
        announce('수집을 취소했습니다.');
      } else {
        setMessage(error.message);
      }
    } finally {
      end();
    }
  };

  // -------------------------------------------------------------------------
  // Export

  const handleExport = async (format) => {
    if (items.length === 0) {
      return;
    }

    start({ kind: 'export', label: '파일을 저장하는 중…', cancellable: false });
    setMessage('');

    try {
      await saveList({ items, prefix: 'wl-export', stamp: formatFileStamp(new Date()), format, kind: 'export' });
      announce(`${formatCount(items.length)}개를 ${format.toUpperCase()} 파일로 내보냈습니다.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      end();
    }
  };

  // -------------------------------------------------------------------------
  // Categories

  const handleFetchCategories = async () => {
    if (!hasApiKey || items.length === 0) {
      return;
    }

    // Asked first, inside the click: Chrome shows the prompt only during a
    // user gesture, and resolves at once when the permission is already held.
    const granted = await requestApiPermission().catch(() => false);

    if (!granted) {
      setMessage('www.googleapis.com 접근 권한을 허용해야 카테고리를 조회할 수 있습니다.');
      return;
    }

    const missing = items.map((item) => item.videoId).filter((videoId) => !categories.has(videoId));

    if (missing.length === 0) {
      announce('모든 영상의 카테고리를 이미 확인했습니다.');
      return;
    }

    const controller = start({ kind: 'categories', label: `카테고리 조회 중… 0 / ${formatCount(missing.length)}` });
    const found = new Map(categories);

    setMessage('');
    update({ value: 0, max: missing.length });

    try {
      await fetchCategories({
        apiKey: settings.apiKey,
        videoIds: missing,
        signal: controller.signal,
        onBatch: (entries, { done, total }) => {
          for (const [videoId, categoryId] of entries) {
            found.set(videoId, categoryId);
          }

          data.setCategories(new Map(found));
          update({ label: `카테고리 조회 중… ${formatCount(done)} / ${formatCount(total)}`, value: done, max: total });
        },
      });
      announce('카테고리를 조회했습니다.');
    } catch (error) {
      if (!isAbortError(error)) {
        setMessage(error.message);
      }
    } finally {
      await data.saveCategories(found);
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
        return 'www.googleapis.com 접근 권한을 허용하지 않아 API 키를 저장하지 않았습니다.';
      }
    }

    if (keyChanged && !next.apiKey) {
      await removeApiPermission().catch(() => false);
    }

    await data.saveSettings(next);
    announce('설정을 저장했습니다.');

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

  const runRemoval = async ({ targets, dryRun }) => {
    const controller = start({ kind: 'remove', label: dryRun ? 'YouTube 탭을 준비하는 중…' : '삭제 대상을 백업 파일로 저장하는 중…' });
    const removed = new Set();
    const verb = dryRun ? '확인' : '삭제';
    let currentTitle = '';
    let outcome = null;

    setDialog(null);
    setMessage('');

    try {
      if (!dryRun) {
        const stamp = formatFileStamp(new Date());

        await saveList({ items: targets, prefix: 'wl-delete-backup', stamp, format: 'json', kind: 'delete-backup' });
        await saveList({ items: targets, prefix: 'wl-delete-backup', stamp, format: 'csv', kind: 'delete-backup' });
        update({ label: 'YouTube 탭을 준비하는 중…' });
      }

      const { tab } = await prepareWatchLaterTab({ activate: true });

      update({ label: `${verb} 준비 중… 0 / ${formatCount(targets.length)}`, value: 0, max: targets.length });

      outcome = await runJob({
        tabId: tab.id,
        command: {
          type: 'remove',
          targets: targets.map(({ videoId, title }) => ({ videoId, title })),
          options: {
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
              store.savePendingRemovals(removed).catch(() => {});
            }
          }

          if (progress.current) {
            currentTitle = progress.current.title;
          }

          update({
            label: progress.paused
              ? '일시 정지: 나중에 볼 동영상 탭이 화면에 보이면 이어서 진행합니다.'
              : `${verb} 중… ${formatCount(progress.done)} / ${formatCount(progress.total)} · ${currentTitle}`,
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

  const handleToggle = useCallback((videoId) => setSelected((current) => toggleOne(current, videoId)), []);

  const handleSelectGroup = useCallback((videoIds, checked) => {
    setSelected((current) => (checked ? addAll(current, videoIds) : removeAll(current, videoIds)));
  }, []);

  const handleToggleCollapse = useCallback((key) => {
    setCollapsed((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }, []);

  const renderRow = (row, layout) => {
    if (row.type === 'group') {
      return (
        <GroupRow
          key={row.key}
          group={row}
          {...layout}
          coverage={readCoverage(selected, row.videoIds)}
          onSelectGroup={handleSelectGroup}
          onToggleCollapse={handleToggleCollapse}
        />
      );
    }

    const categoryId = categories.get(row.item.videoId);

    return (
      <VideoRow
        key={row.key}
        item={row.item}
        {...layout}
        selected={selected.has(row.item.videoId)}
        failure={failures.get(row.item.videoId)}
        isMusic={categoryId === MUSIC_CATEGORY_ID}
        onToggle={handleToggle}
      />
    );
  };

  // -------------------------------------------------------------------------
  // Layout

  const summary = useMemo(() => {
    if (!snapshot) {
      return '';
    }

    const parts = [`전체 ${formatCount(items.length)}개`];

    if (view.items.length !== items.length) {
      parts.push(`표시 ${formatCount(view.items.length)}개`);
    }

    parts.push(`${formatDateTime(snapshot.collectedAt)} 수집`);

    if (snapshot.method === 'dom') {
      parts.push('스크롤 방식');
    }

    return parts.join(' · ');
  }, [snapshot, items.length, view.items.length]);

  const categoryNote = useMemo(() => {
    if (!hasApiKey) {
      return '카테고리 필터를 쓰려면 설정에서 YouTube Data API 키를 넣어 주세요.';
    }

    if (items.length === 0) {
      return '';
    }

    const known = items.filter((item) => categories.has(item.videoId)).length;
    const rest = known < items.length ? ' [조회]를 누르면 나머지를 확인합니다.' : '';

    return `카테고리 확인 ${formatCount(known)} / ${formatCount(items.length)}개.${rest}`;
  }, [hasApiKey, items, categories]);

  let emptyReason = null;

  if (!snapshot) {
    emptyReason = 'none';
  } else if (items.length === 0) {
    emptyReason = 'empty';
  } else if (view.rows.length === 0) {
    emptyReason = 'filtered';
  }

  if (!data.ready) {
    return null;
  }

  return (
    <div className="app">
      <AppHeader
        isTabView={IS_TAB_VIEW}
        busy={busy}
        hasItems={items.length > 0}
        onScan={handleScan}
        onExport={handleExport}
        onOpenSettings={() => setDialog('settings')}
        onOpenInTab={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/manager.html?view=tab') })}
      />
      <StatusBar summary={summary} task={task} onCancel={cancel} message={message} onDismissMessage={() => setMessage('')} />
      <FilterBar
        query={query}
        onQueryChange={setQuery}
        prefs={prefs}
        durationFilter={durationFilter}
        onPrefsChange={data.updatePrefs}
        buckets={buckets}
        hasApiKey={hasApiKey}
        canFetchCategories={hasApiKey && !busy && items.length > 0}
        categoryNote={categoryNote}
        onFetchCategories={handleFetchCategories}
      />
      <SelectionBar
        selectedCount={selected.size}
        totalCount={items.length}
        viewCount={view.items.length}
        busy={busy}
        onSelectAll={() => setSelected(new Set(items.map((item) => item.videoId)))}
        onSelectView={() => setSelected((current) => addAll(current, viewIds))}
        onClear={() => setSelected(new Set())}
        onRemove={() => setDialog('remove')}
      />
      <main className="list-area">
        {emptyReason ? (
          <EmptyState reason={emptyReason} busy={busy} onScan={handleScan} />
        ) : (
          <VirtualList
            className="video-list"
            label="나중에 볼 동영상 목록"
            rows={view.rows}
            getHeight={getRowHeight}
            renderRow={renderRow}
            resetKey={`${deferredQuery}|${durationFilter}|${prefs.categoryFilter}|${prefs.groupBy}|${prefs.sortBy}|${prefs.sortDir}`}
          />
        )}
      </main>
      <SettingsDialog open={dialog === 'settings'} settings={settings} onClose={() => setDialog(null)} onSave={handleSaveSettings} />
      <RemoveDialog
        open={dialog === 'remove'}
        items={selectedItems}
        defaultTestCount={settings.testModeCount}
        onClose={() => setDialog(null)}
        onConfirm={runRemoval}
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
