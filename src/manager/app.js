import { fetchCategories, removeApiPermission, requestApiPermission } from './categories.js';
import { buildCsv, buildFileName, buildJson, downloadText, toVideoUrl } from './export.js';
import { formatCount, formatDateTime, formatDuration, formatFileStamp, formatTotalDuration } from './format.js';
import { SETTINGS_LIMITS, formatBounds, normalizeSettings, validateSettingsForm } from './settings.js';
import { createSnapshot, isVideoId, readSnapshot, removeFromSnapshot } from './snapshot.js';
import * as store from './store.js';
import { prepareWatchLaterTab, runJob } from './tab-bridge.js';
import { MUSIC_CATEGORY_ID, buildSearchText, buildView, createBuckets, normalizeViewPrefs } from './view-model.js';
import { createVirtualList } from './virtual-list.js';

const ITEM_ROW_HEIGHT = 68;
const GROUP_ROW_HEIGHT = 44;
const SEARCH_DELAY = 150;
const PREVIEW_LIMIT = 50;
const PENDING_SAVE_INTERVAL = 10;
const IS_TAB_VIEW = new URLSearchParams(location.search).get('view') === 'tab';

const byId = (id) => document.getElementById(id);

const elements = {
  openInTab: byId('open-in-tab'),
  openSettings: byId('open-settings'),
  collect: byId('collect'),
  exportJson: byId('export-json'),
  exportCsv: byId('export-csv'),
  summary: byId('summary'),
  task: byId('task'),
  taskLabel: byId('task-label'),
  taskProgress: byId('task-progress'),
  taskCancel: byId('task-cancel'),
  message: byId('message'),
  search: byId('search'),
  groupBy: byId('group-by'),
  sortBy: byId('sort-by'),
  sortDir: byId('sort-dir'),
  durationFilter: byId('duration-filter'),
  categoryFilter: byId('category-filter'),
  fetchCategories: byId('fetch-categories'),
  categoryNote: byId('category-note'),
  selectionCount: byId('selection-count'),
  selectAll: byId('select-all'),
  selectFiltered: byId('select-filtered'),
  clearSelection: byId('clear-selection'),
  removeSelected: byId('remove-selected'),
  list: byId('list'),
  empty: byId('empty'),
  settingsDialog: byId('settings-dialog'),
  settingsForm: byId('settings-form'),
  settingBounds: byId('setting-bounds'),
  settingDelayMin: byId('setting-delay-min'),
  settingDelayMax: byId('setting-delay-max'),
  settingTestCount: byId('setting-test-count'),
  settingApiKey: byId('setting-api-key'),
  settingsMessage: byId('settings-message'),
  settingsCancel: byId('settings-cancel'),
  removeDialog: byId('remove-dialog'),
  removeForm: byId('remove-form'),
  removeSummary: byId('remove-summary'),
  removePreview: byId('remove-preview'),
  removeTestMode: byId('remove-test-mode'),
  removeTestCount: byId('remove-test-count'),
  removeDryRun: byId('remove-dry-run'),
  removeCancel: byId('remove-cancel'),
  removeConfirm: byId('remove-confirm'),
  resultDialog: byId('result-dialog'),
  resultTitle: byId('result-title'),
  resultSummary: byId('result-summary'),
  resultFailures: byId('result-failures'),
  resultFailureList: byId('result-failure-list'),
  resultSelectFailed: byId('result-select-failed'),
  resultClose: byId('result-close'),
  announcer: byId('announcer'),
};

// Each settings field, the element that shows its error, and the key the
// validator reports it under.
const SETTINGS_FIELDS = [
  { key: 'bounds', input: elements.settingBounds, error: byId('setting-bounds-error') },
  { key: 'delayMin', input: elements.settingDelayMin, error: byId('setting-delay-error') },
  { key: 'delayMax', input: elements.settingDelayMax, error: byId('setting-delay-error') },
  { key: 'testModeCount', input: elements.settingTestCount, error: byId('setting-test-count-error') },
  { key: 'apiKey', input: elements.settingApiKey, error: byId('setting-api-key-error') },
];

const state = {
  snapshot: null,
  settings: normalizeSettings(null),
  prefs: normalizeViewPrefs(null),
  buckets: [],
  categories: new Map(),
  searchTexts: new Map(),
  query: '',
  selected: new Set(),
  collapsed: new Set(),
  // Reasons for videos whose last removal failed, shown on their rows.
  failures: new Map(),
  lastFailedIds: [],
  view: { items: [], rows: [] },
  rowsByKey: new Map(),
  task: null,
};

const rowParts = new WeakMap();

const isAbortError = (error) => error?.name === 'AbortError';

const hasApiKey = () => Boolean(state.settings.apiKey);

const createElement = (tag, { className, text } = {}) => {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
};

const announce = (text) => {
  elements.announcer.textContent = '';
  requestAnimationFrame(() => {
    elements.announcer.textContent = text;
  });
};

const showMessage = (text) => {
  elements.message.textContent = text;
  elements.message.hidden = !text;
};

const readCategories = (stored) => new Map(Object.entries(stored && typeof stored === 'object' ? stored : {})
  .filter(([videoId, categoryId]) => isVideoId(videoId) && typeof categoryId === 'string' && categoryId.length <= 4));

// ---------------------------------------------------------------------------
// Rows

const createItemRow = () => {
  const row = createElement('div', { className: 'row item-row' });
  const check = createElement('input', { className: 'row-check' });
  const thumb = createElement('img', { className: 'thumb' });
  const body = createElement('div', { className: 'row-body' });
  const title = createElement('a', { className: 'row-title' });
  const meta = createElement('div', { className: 'row-meta' });
  const channel = createElement('span', { className: 'row-channel' });
  const duration = createElement('span', { className: 'row-duration' });
  const position = createElement('span', { className: 'row-position' });
  const music = createElement('span', { className: 'badge music', text: '음악' });
  const failed = createElement('span', { className: 'badge failed', text: '삭제 실패' });

  row.setAttribute('role', 'listitem');
  check.type = 'checkbox';
  thumb.alt = '';
  thumb.width = 80;
  thumb.height = 45;
  thumb.loading = 'lazy';
  thumb.decoding = 'async';
  thumb.referrerPolicy = 'no-referrer';
  title.target = '_blank';
  title.rel = 'noopener noreferrer';

  meta.append(channel, duration, position, music, failed);
  body.append(title, meta);
  row.append(check, thumb, body);
  rowParts.set(row, { check, thumb, title, channel, duration, position, music, failed });

  return row;
};

const updateItemRow = (row, { item }) => {
  const parts = rowParts.get(row);
  const selected = state.selected.has(item.videoId);
  const failure = state.failures.get(item.videoId);

  row.classList.toggle('is-selected', selected);
  parts.check.checked = selected;
  parts.check.setAttribute('aria-label', `선택: ${item.title || item.videoId}`);

  if (parts.thumb.getAttribute('src') !== item.thumbnail) {
    parts.thumb.src = item.thumbnail;
  }

  parts.title.textContent = item.title || '(제목 없음)';
  parts.title.title = item.title;
  parts.title.href = toVideoUrl(item.videoId);
  parts.channel.textContent = item.channelName || '채널 정보 없음';
  parts.duration.textContent = item.durationText || formatDuration(item.durationSeconds) || '길이 정보 없음';
  parts.position.textContent = `#${item.position}`;
  parts.music.hidden = state.categories.get(item.videoId) !== MUSIC_CATEGORY_ID;
  parts.failed.hidden = !failure;
  parts.failed.title = failure ?? '';
};

const createGroupRow = () => {
  const row = createElement('div', { className: 'row group-row' });
  const check = createElement('input', { className: 'group-check' });
  const toggle = createElement('button', { className: 'group-toggle' });
  const caret = createElement('span', { className: 'group-caret' });
  const label = createElement('span', { className: 'group-label' });
  const meta = createElement('span', { className: 'group-meta' });

  row.setAttribute('role', 'listitem');
  check.type = 'checkbox';
  toggle.type = 'button';
  caret.setAttribute('aria-hidden', 'true');

  toggle.append(caret, label, meta);
  row.append(check, toggle);
  rowParts.set(row, { check, toggle, label, meta });

  return row;
};

const updateGroupRow = (row, group) => {
  const parts = rowParts.get(row);
  let selectedCount = 0;

  for (const videoId of group.videoIds) {
    if (state.selected.has(videoId)) {
      selectedCount += 1;
    }
  }

  parts.check.checked = selectedCount > 0 && selectedCount === group.count;
  parts.check.indeterminate = selectedCount > 0 && selectedCount < group.count;
  parts.check.setAttribute('aria-label', `${group.label} 그룹 전체 선택`);
  parts.toggle.setAttribute('aria-expanded', String(!group.collapsed));
  parts.label.textContent = group.label;
  parts.meta.textContent = `${formatCount(group.count)}개 · ${formatTotalDuration(group.totalSeconds)}`;
};

const list = createVirtualList({
  container: elements.list,
  label: '나중에 볼 동영상 목록',
  getHeight: (row) => (row.type === 'group' ? GROUP_ROW_HEIGHT : ITEM_ROW_HEIGHT),
  getKey: (row) => row.key,
  createRow: (row) => (row.type === 'group' ? createGroupRow() : createItemRow()),
  updateRow: (element, row) => (row.type === 'group' ? updateGroupRow(element, row) : updateItemRow(element, row)),
});

// ---------------------------------------------------------------------------
// Rendering

const renderControls = () => {
  const busy = state.task !== null;
  const itemCount = state.snapshot?.items.length ?? 0;

  elements.collect.disabled = busy;
  elements.exportJson.disabled = busy || itemCount === 0;
  elements.exportCsv.disabled = busy || itemCount === 0;
  elements.openSettings.disabled = busy;
  elements.categoryFilter.disabled = !hasApiKey();
  elements.categoryFilter.value = hasApiKey() ? state.prefs.categoryFilter : 'all';
  elements.fetchCategories.disabled = busy || itemCount === 0 || !hasApiKey();
  elements.selectAll.disabled = itemCount === 0;
  elements.selectFiltered.disabled = state.view.items.length === 0;
  elements.clearSelection.disabled = state.selected.size === 0;
  elements.removeSelected.disabled = busy || state.selected.size === 0;
};

const renderSummary = () => {
  if (!state.snapshot) {
    elements.summary.textContent = '아직 수집한 목록이 없습니다.';
    return;
  }

  const total = state.snapshot.items.length;
  const shown = state.view.items.length;
  const parts = [`전체 ${formatCount(total)}개`];

  if (shown !== total) {
    parts.push(`표시 ${formatCount(shown)}개`);
  }

  parts.push(`${formatDateTime(state.snapshot.collectedAt)} 수집`);

  if (state.snapshot.method === 'dom') {
    parts.push('스크롤 방식');
  }

  elements.summary.textContent = parts.join(' · ');
};

const renderCategoryNote = () => {
  const items = state.snapshot?.items ?? [];

  if (!hasApiKey()) {
    elements.categoryNote.textContent = '카테고리 필터를 쓰려면 설정에서 YouTube Data API 키를 넣어 주세요.';
    return;
  }

  if (items.length === 0) {
    elements.categoryNote.textContent = '';
    return;
  }

  const known = items.filter((item) => state.categories.has(item.videoId)).length;
  const rest = known < items.length ? ' [조회]를 누르면 나머지를 확인합니다.' : '';

  elements.categoryNote.textContent = `카테고리 확인 ${formatCount(known)} / ${formatCount(items.length)}개.${rest}`;
};

const renderSelection = () => {
  elements.selectionCount.textContent = `선택 ${formatCount(state.selected.size)}개`;
  renderControls();
};

const renderEmpty = () => {
  const lines = [];

  if (!state.snapshot) {
    lines.push('아직 수집한 목록이 없습니다.', 'YouTube에 로그인한 상태에서 [목록 수집]을 누르세요.');
  } else if (state.snapshot.items.length === 0) {
    lines.push('나중에 볼 동영상 목록이 비어 있습니다.');
  } else if (state.view.rows.length === 0) {
    lines.push('조건에 맞는 영상이 없습니다.');
  }

  elements.empty.replaceChildren(...lines.map((line) => createElement('p', { text: line })));
  elements.empty.hidden = lines.length === 0;
};

const renderDurationOptions = () => {
  const options = [new Option('전체', 'all'), ...state.buckets.map((bucket) => new Option(bucket.label, bucket.key))];

  elements.durationFilter.replaceChildren(...options);
  elements.durationFilter.value = state.prefs.durationFilter;
};

const renderViewControls = () => {
  elements.groupBy.value = state.prefs.groupBy;
  elements.sortBy.value = state.prefs.sortBy;
  elements.sortDir.textContent = state.prefs.sortDir === 'asc' ? '오름차순' : '내림차순';
  elements.categoryFilter.value = state.prefs.categoryFilter;
  renderDurationOptions();
};

const recomputeView = ({ resetScroll = false } = {}) => {
  state.view = buildView({
    items: state.snapshot?.items ?? [],
    searchTexts: state.searchTexts,
    query: state.query,
    durationFilter: state.prefs.durationFilter,
    categoryFilter: hasApiKey() ? state.prefs.categoryFilter : 'all',
    categories: state.categories,
    buckets: state.buckets,
    groupBy: state.prefs.groupBy,
    sortBy: state.prefs.sortBy,
    sortDir: state.prefs.sortDir,
    collapsed: state.collapsed,
  });
  state.rowsByKey = new Map(state.view.rows.map((row) => [row.key, row]));
  list.setRows(state.view.rows, { resetScroll });
  renderSummary();
  renderEmpty();
  renderCategoryNote();
  renderSelection();
};

const setSnapshot = (snapshot) => {
  const ids = new Set(snapshot?.items.map((item) => item.videoId) ?? []);

  state.snapshot = snapshot;
  state.searchTexts = new Map(snapshot?.items.map((item) => [item.videoId, buildSearchText(item)]) ?? []);
  state.selected = new Set([...state.selected].filter((videoId) => ids.has(videoId)));

  for (const videoId of state.failures.keys()) {
    if (!ids.has(videoId)) {
      state.failures.delete(videoId);
    }
  }

  recomputeView();
};

const applySettings = (settings) => {
  state.settings = settings;
  state.buckets = createBuckets(settings.durationBounds);

  if (!state.buckets.some((bucket) => bucket.key === state.prefs.durationFilter)) {
    state.prefs.durationFilter = 'all';
  }

  renderDurationOptions();
  recomputeView();
};

// ---------------------------------------------------------------------------
// Selection

const setSelected = (videoIds, selected) => {
  for (const videoId of videoIds) {
    if (selected) {
      state.selected.add(videoId);
    } else {
      state.selected.delete(videoId);
    }
  }

  list.refresh();
  renderSelection();
};

const replaceSelection = (videoIds) => {
  state.selected = new Set(videoIds);
  list.refresh();
  renderSelection();
};

// Selected videos in list order, which is also the order they are removed in.
const getSelectedItems = () => (state.snapshot?.items ?? []).filter((item) => state.selected.has(item.videoId));

// ---------------------------------------------------------------------------
// Tasks

const updateTask = (patch) => {
  if (patch.label !== undefined) {
    elements.taskLabel.textContent = patch.label;
  }

  if ('value' in patch) {
    if (patch.value == null) {
      elements.taskProgress.removeAttribute('value');
    } else {
      elements.taskProgress.max = Math.max(patch.max ?? 1, 1);
      elements.taskProgress.value = patch.value;
    }
  }
};

const startTask = ({ kind, label, cancellable = true }) => {
  const controller = new AbortController();

  state.task = { kind, controller };
  showMessage('');
  elements.task.hidden = false;
  elements.taskCancel.hidden = !cancellable;
  elements.taskCancel.disabled = false;
  updateTask({ label, value: null });
  renderControls();

  return controller;
};

const endTask = () => {
  state.task = null;
  elements.task.hidden = true;
  renderControls();
};

const saveList = ({ items, prefix, stamp, format, kind }) => {
  const isJson = format === 'json';

  return downloadText({
    filename: buildFileName({ prefix, stamp, extension: format }),
    text: isJson ? buildJson({ items, categories: state.categories, kind, exportedAt: Date.now() }) : buildCsv(items, state.categories),
    type: isJson ? 'application/json' : 'text/csv',
  });
};

// Drops category entries of videos that are no longer in the list.
const pruneCategories = async () => {
  const ids = new Set(state.snapshot?.items.map((item) => item.videoId) ?? []);
  const before = state.categories.size;

  for (const videoId of state.categories.keys()) {
    if (!ids.has(videoId)) {
      state.categories.delete(videoId);
    }
  }

  if (state.categories.size !== before) {
    await store.saveCategories(state.categories);
  }
};

const describeCollectProgress = ({ count, paused }) => (paused
  ? `${formatCount(count)}개까지 읽었습니다. YouTube 탭이 화면에 보이면 이어서 진행합니다.`
  : `${formatCount(count)}개 수집 중…`);

const handleCollect = async () => {
  const controller = startTask({ kind: 'collect', label: 'YouTube 탭을 준비하는 중…' });
  const onProgress = (progress) => updateTask({ label: describeCollectProgress(progress) });

  try {
    let { tab } = await prepareWatchLaterTab({ activate: false });
    let result = null;

    updateTask({ label: '목록을 수집하는 중…' });

    try {
      result = await runJob({ tabId: tab.id, command: { type: 'collect', mode: 'auto' }, signal: controller.signal, onProgress });
    } catch (error) {
      if (error.code !== 'needs-dom') {
        throw error;
      }

      // Scrolling only works in a visible tab, so the tab comes to the front.
      updateTask({ label: '페이지 데이터로 읽지 못해 스크롤 방식으로 다시 수집합니다…' });
      ({ tab } = await prepareWatchLaterTab({ activate: true }));
      result = await runJob({ tabId: tab.id, command: { type: 'collect', mode: 'dom' }, signal: controller.signal, onProgress });
    }

    const snapshot = createSnapshot({ ...result, collectedAt: Date.now() });

    await store.saveSnapshot(snapshot);
    await store.clearPendingRemovals();
    state.failures.clear();
    setSnapshot(snapshot);
    await pruneCategories();
    announce(`${formatCount(snapshot.items.length)}개를 수집했습니다.`);
  } catch (error) {
    if (isAbortError(error)) {
      announce('수집을 취소했습니다.');
    } else {
      showMessage(error.message);
    }
  } finally {
    endTask();
  }
};

const handleExport = async (format) => {
  const items = state.snapshot?.items ?? [];

  if (items.length === 0) {
    return;
  }

  startTask({ kind: 'export', label: '파일을 저장하는 중…', cancellable: false });

  try {
    await saveList({ items, prefix: 'wl-export', stamp: formatFileStamp(new Date()), format, kind: 'export' });
    announce(`${formatCount(items.length)}개를 ${format.toUpperCase()} 파일로 내보냈습니다.`);
  } catch (error) {
    showMessage(error.message);
  } finally {
    endTask();
  }
};

const handleFetchCategories = async () => {
  if (!hasApiKey() || !state.snapshot) {
    return;
  }

  // Asked first, inside the click: Chrome shows the prompt only during a
  // user gesture, and resolves at once when the permission is already held.
  const granted = await requestApiPermission().catch(() => false);

  if (!granted) {
    showMessage('www.googleapis.com 접근 권한을 허용해야 카테고리를 조회할 수 있습니다.');
    return;
  }

  const missing = state.snapshot.items.map((item) => item.videoId).filter((videoId) => !state.categories.has(videoId));

  if (missing.length === 0) {
    announce('모든 영상의 카테고리를 이미 확인했습니다.');
    return;
  }

  const controller = startTask({ kind: 'categories', label: `카테고리 조회 중… 0 / ${formatCount(missing.length)}` });

  updateTask({ value: 0, max: missing.length });

  try {
    await fetchCategories({
      apiKey: state.settings.apiKey,
      videoIds: missing,
      signal: controller.signal,
      onBatch: (entries, { done, total }) => {
        for (const [videoId, categoryId] of entries) {
          state.categories.set(videoId, categoryId);
        }

        updateTask({ label: `카테고리 조회 중… ${formatCount(done)} / ${formatCount(total)}`, value: done, max: total });
      },
    });
    announce('카테고리를 조회했습니다.');
  } catch (error) {
    if (!isAbortError(error)) {
      showMessage(error.message);
    }
  } finally {
    await store.saveCategories(state.categories);
    endTask();
    recomputeView();
  }
};

// ---------------------------------------------------------------------------
// Removal

const applyRemovals = async (removedIds) => {
  if (!state.snapshot) {
    return;
  }

  const snapshot = removeFromSnapshot(state.snapshot, removedIds);

  await store.saveSnapshot(snapshot);
  await store.clearPendingRemovals();

  for (const videoId of removedIds) {
    state.selected.delete(videoId);
    state.failures.delete(videoId);
  }

  setSnapshot(snapshot);
};

const showResult = ({ outcome, targets, dryRun }) => {
  const titles = new Map(targets.map((item) => [item.videoId, item.title || item.videoId]));
  const failed = outcome.results.filter((result) => !result.ok);
  const succeeded = outcome.results.length - failed.length;
  const skipped = targets.length - outcome.results.length;
  const counts = [dryRun ? `정상 ${formatCount(succeeded)}개` : `삭제 ${formatCount(succeeded)}개`, `실패 ${formatCount(failed.length)}개`];
  const lines = [];

  if (skipped > 0) {
    counts.push(`처리하지 않음 ${formatCount(skipped)}개`);
  }

  if (outcome.cancelled) {
    lines.push('작업을 취소했습니다.');
  }

  if (outcome.stopReason) {
    lines.push(outcome.stopReason);
  }

  lines.push(`${counts.join(' · ')}.`);

  if (dryRun && failed.length === 0 && skipped === 0) {
    lines.push('모든 항목에서 삭제 메뉴를 찾았습니다. 드라이런을 끄고 실제로 삭제할 수 있습니다.');
  }

  if (!dryRun) {
    for (const result of failed) {
      state.failures.set(result.videoId, result.reason);
    }
  }

  state.lastFailedIds = failed.map((result) => result.videoId);
  elements.resultTitle.textContent = dryRun ? '드라이런 결과' : '삭제 결과';
  elements.resultSummary.textContent = lines.join(' ');
  elements.resultFailureList.replaceChildren(...failed.map((result) => {
    const item = createElement('li', { text: `${titles.get(result.videoId)} ` });

    item.append(createElement('span', { className: 'reason', text: `(${result.reason})` }));

    return item;
  }));
  elements.resultFailures.hidden = failed.length === 0;
  elements.resultSelectFailed.hidden = failed.length === 0;
  list.refresh();
  elements.resultDialog.showModal();
};

const runRemoval = async ({ targets, dryRun }) => {
  const controller = startTask({ kind: 'remove', label: dryRun ? 'YouTube 탭을 준비하는 중…' : '삭제 대상을 백업 파일로 저장하는 중…' });
  const removed = new Set();
  let currentTitle = '';
  let outcome = null;

  try {
    if (!dryRun) {
      const stamp = formatFileStamp(new Date());

      await saveList({ items: targets, prefix: 'wl-delete-backup', stamp, format: 'json', kind: 'delete-backup' });
      await saveList({ items: targets, prefix: 'wl-delete-backup', stamp, format: 'csv', kind: 'delete-backup' });
      updateTask({ label: 'YouTube 탭을 준비하는 중…' });
    }

    const { tab } = await prepareWatchLaterTab({ activate: true });
    const verb = dryRun ? '확인' : '삭제';

    updateTask({ label: `${verb} 준비 중… 0 / ${formatCount(targets.length)}`, value: 0, max: targets.length });

    outcome = await runJob({
      tabId: tab.id,
      command: {
        type: 'remove',
        targets: targets.map(({ videoId, title }) => ({ videoId, title })),
        options: {
          delayMin: state.settings.removeDelayMin * 1000,
          delayMax: state.settings.removeDelayMax * 1000,
          dryRun,
          removeLabels: state.snapshot?.removeLabel ? [state.snapshot.removeLabel] : [],
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

        const label = progress.paused
          ? '일시 정지: 나중에 볼 동영상 탭이 화면에 보이면 이어서 진행합니다.'
          : `${verb} 중… ${formatCount(progress.done)} / ${formatCount(progress.total)} · ${currentTitle}`;

        updateTask({ label, value: progress.done, max: progress.total });
      },
    });
  } catch (error) {
    if (!isAbortError(error)) {
      showMessage(error.message);
    }
  } finally {
    if (removed.size > 0) {
      await applyRemovals(removed);
    }

    endTask();
  }

  if (outcome) {
    showResult({ outcome, targets, dryRun });
  }
};

const syncRemoveDialog = () => {
  const dryRun = elements.removeDryRun.checked;

  elements.removeTestCount.disabled = !elements.removeTestMode.checked;
  elements.removeConfirm.textContent = dryRun ? '확인 시작' : '삭제 시작';
  elements.removeConfirm.classList.toggle('danger', !dryRun);
  elements.removeConfirm.classList.toggle('primary', dryRun);
};

const openRemoveDialog = () => {
  const items = getSelectedItems();

  if (items.length === 0) {
    return;
  }

  const preview = items.slice(0, PREVIEW_LIMIT).map((item) => createElement('li', {
    text: `${item.title || item.videoId} · ${item.channelName || '채널 정보 없음'}`,
  }));

  if (items.length > PREVIEW_LIMIT) {
    preview.push(createElement('li', { text: `외 ${formatCount(items.length - PREVIEW_LIMIT)}개` }));
  }

  elements.removeSummary.textContent = `선택한 ${formatCount(items.length)}개를 나중에 볼 동영상에서 삭제합니다. 목록 순서대로 한 건씩 처리합니다.`;
  elements.removePreview.replaceChildren(...preview);
  elements.removeTestMode.checked = false;
  elements.removeTestCount.value = String(state.settings.testModeCount);
  elements.removeTestCount.removeAttribute('aria-invalid');
  elements.removeDryRun.checked = false;
  syncRemoveDialog();
  elements.removeDialog.showModal();
};

const handleRemoveSubmit = async (event) => {
  event.preventDefault();

  const items = getSelectedItems();
  const testMode = elements.removeTestMode.checked;
  const testCount = Number(elements.removeTestCount.value);

  if (testMode && !(Number.isInteger(testCount) && testCount >= 1 && testCount <= SETTINGS_LIMITS.testModeMax)) {
    elements.removeTestCount.setAttribute('aria-invalid', 'true');
    elements.removeTestCount.focus();
    return;
  }

  elements.removeDialog.close();
  await runRemoval({ targets: testMode ? items.slice(0, testCount) : items, dryRun: elements.removeDryRun.checked });
};

// ---------------------------------------------------------------------------
// Settings

const showSettingsErrors = (errors) => {
  for (const { input, error } of SETTINGS_FIELDS) {
    input.removeAttribute('aria-invalid');
    error.textContent = '';
    error.hidden = true;
  }

  let first = null;

  for (const { key, input, error } of SETTINGS_FIELDS) {
    if (!errors[key]) {
      continue;
    }

    input.setAttribute('aria-invalid', 'true');
    error.textContent = error.textContent ? `${error.textContent} ${errors[key]}` : errors[key];
    error.hidden = false;
    first ??= input;
  }

  first?.focus();
};

const openSettings = () => {
  showSettingsErrors({});
  elements.settingsMessage.hidden = true;
  elements.settingBounds.value = formatBounds(state.settings.durationBounds);
  elements.settingDelayMin.value = String(state.settings.removeDelayMin);
  elements.settingDelayMax.value = String(state.settings.removeDelayMax);
  elements.settingTestCount.value = String(state.settings.testModeCount);
  elements.settingApiKey.value = state.settings.apiKey;
  elements.settingsDialog.showModal();
};

const handleSettingsSubmit = async (event) => {
  event.preventDefault();

  const { settings, errors } = validateSettingsForm({
    boundsText: elements.settingBounds.value,
    delayMin: elements.settingDelayMin.value,
    delayMax: elements.settingDelayMax.value,
    testModeCount: elements.settingTestCount.value,
    apiKey: elements.settingApiKey.value,
  });

  if (errors) {
    showSettingsErrors(errors);
    return;
  }

  showSettingsErrors({});

  const keyChanged = settings.apiKey !== state.settings.apiKey;

  if (keyChanged && settings.apiKey) {
    // The first await in this submit handler, so it still counts as part of
    // the click that Chrome requires for the permission prompt.
    const granted = await requestApiPermission().catch(() => false);

    if (!granted) {
      elements.settingsMessage.textContent = 'www.googleapis.com 접근 권한을 허용하지 않아 API 키를 저장하지 않았습니다.';
      elements.settingsMessage.hidden = false;
      return;
    }
  }

  if (keyChanged && !settings.apiKey) {
    await removeApiPermission().catch(() => false);
  }

  await store.saveSettings(settings);
  applySettings(settings);
  elements.settingsDialog.close();
  announce('설정을 저장했습니다.');
};

// ---------------------------------------------------------------------------
// Events

const onViewPrefChange = (key, value) => {
  state.prefs[key] = value;
  store.saveViewPrefs(state.prefs).catch(() => {});
  recomputeView({ resetScroll: true });
};

const bindEvents = () => {
  let searchTimer = 0;

  elements.openInTab.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/manager/manager.html?view=tab') });
  });
  elements.openSettings.addEventListener('click', openSettings);
  elements.collect.addEventListener('click', handleCollect);
  elements.exportJson.addEventListener('click', () => handleExport('json'));
  elements.exportCsv.addEventListener('click', () => handleExport('csv'));
  elements.fetchCategories.addEventListener('click', handleFetchCategories);
  elements.taskCancel.addEventListener('click', () => {
    elements.taskCancel.disabled = true;
    updateTask({ label: '취소하는 중…' });
    state.task?.controller.abort();
  });

  elements.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = elements.search.value;
      recomputeView({ resetScroll: true });
    }, SEARCH_DELAY);
  });
  elements.groupBy.addEventListener('change', () => onViewPrefChange('groupBy', elements.groupBy.value));
  elements.sortBy.addEventListener('change', () => onViewPrefChange('sortBy', elements.sortBy.value));
  elements.durationFilter.addEventListener('change', () => onViewPrefChange('durationFilter', elements.durationFilter.value));
  elements.categoryFilter.addEventListener('change', () => onViewPrefChange('categoryFilter', elements.categoryFilter.value));
  elements.sortDir.addEventListener('click', () => {
    onViewPrefChange('sortDir', state.prefs.sortDir === 'asc' ? 'desc' : 'asc');
    elements.sortDir.textContent = state.prefs.sortDir === 'asc' ? '오름차순' : '내림차순';
  });

  elements.selectAll.addEventListener('click', () => replaceSelection(state.snapshot?.items.map((item) => item.videoId) ?? []));
  elements.selectFiltered.addEventListener('click', () => setSelected(state.view.items.map((item) => item.videoId), true));
  elements.clearSelection.addEventListener('click', () => replaceSelection([]));
  elements.removeSelected.addEventListener('click', openRemoveDialog);

  elements.list.addEventListener('change', (event) => {
    const row = state.rowsByKey.get(event.target.closest('.row')?.dataset.key);

    if (!row) {
      return;
    }

    if (event.target.classList.contains('row-check')) {
      setSelected([row.item.videoId], event.target.checked);
    } else if (event.target.classList.contains('group-check')) {
      setSelected(row.videoIds, event.target.checked);
    }
  });

  elements.list.addEventListener('click', (event) => {
    const toggle = event.target.closest('.group-toggle');

    if (toggle) {
      const key = toggle.closest('.row').dataset.key;

      if (state.collapsed.has(key)) {
        state.collapsed.delete(key);
      } else {
        state.collapsed.add(key);
      }

      recomputeView();
      return;
    }

    // A click anywhere on a video row, except its link and checkbox, toggles it.
    const element = event.target.closest('.item-row');

    if (!element || event.target.closest('a, input')) {
      return;
    }

    const row = state.rowsByKey.get(element.dataset.key);

    if (row) {
      setSelected([row.item.videoId], !state.selected.has(row.item.videoId));
    }
  });

  elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
  elements.settingsCancel.addEventListener('click', () => elements.settingsDialog.close());

  elements.removeForm.addEventListener('submit', handleRemoveSubmit);
  elements.removeCancel.addEventListener('click', () => elements.removeDialog.close());
  elements.removeTestMode.addEventListener('change', syncRemoveDialog);
  elements.removeDryRun.addEventListener('change', syncRemoveDialog);

  elements.resultClose.addEventListener('click', () => elements.resultDialog.close());
  elements.resultSelectFailed.addEventListener('click', () => {
    const ids = new Set(state.snapshot?.items.map((item) => item.videoId) ?? []);

    replaceSelection(state.lastFailedIds.filter((videoId) => ids.has(videoId)));
    elements.resultDialog.close();
  });

  // Closing a tab mid-removal would cancel it; ask first.
  window.addEventListener('beforeunload', (event) => {
    if (state.task?.kind === 'remove') {
      event.preventDefault();
    }
  });

  // Follow changes made by the other open manager (side panel or tab).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return;
    }

    const { snapshot, settings, categories } = changes;

    if (snapshot && snapshot.newValue?.savedBy !== store.INSTANCE_ID) {
      setSnapshot(readSnapshot(snapshot.newValue));
    }

    if (settings) {
      applySettings(normalizeSettings(settings.newValue));
    }

    if (categories && !state.task) {
      state.categories = readCategories(categories.newValue);
      recomputeView();
    }
  });
};

const init = async () => {
  elements.openInTab.hidden = IS_TAB_VIEW;
  bindEvents();

  const data = await store.loadAll();
  const pending = Array.isArray(data.pendingRemovals) ? data.pendingRemovals.filter(isVideoId) : [];
  let snapshot = readSnapshot(data.snapshot);

  state.settings = normalizeSettings(data.settings);
  state.buckets = createBuckets(state.settings.durationBounds);
  state.prefs = normalizeViewPrefs(data.viewPrefs);
  state.categories = readCategories(data.categories);

  if (!state.buckets.some((bucket) => bucket.key === state.prefs.durationFilter)) {
    state.prefs.durationFilter = 'all';
  }

  // Removals from a job whose manager closed before it could save them.
  if (pending.length > 0) {
    if (snapshot) {
      snapshot = removeFromSnapshot(snapshot, new Set(pending));
      await store.saveSnapshot(snapshot);
    }

    await store.clearPendingRemovals();
  }

  renderViewControls();
  setSnapshot(snapshot);
};

init().catch((error) => showMessage(`관리 화면을 불러오지 못했습니다. ${error.message}`));
