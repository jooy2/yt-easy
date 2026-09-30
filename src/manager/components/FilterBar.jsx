import { Button, IconButton, Select, TextField, Tooltip } from 'neba';

import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NOT_MUSIC,
  CATEGORY_FILTER_UNKNOWN,
  INFO_SORTS,
  readCategoryName,
} from '../lib/view-model.js';

import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from './icons.jsx';

// Sorting by channel name, length, or category also lists the channels, the
// length ranges, or the categories beside the videos. "추가된 날짜순" is the
// order of the list on YouTube.
const SORT_ITEMS = [
  { value: 'position', label: '추가된 날짜순' },
  { value: 'published', label: '게시일순' },
  { value: 'views', label: '조회수순' },
  { value: 'channel', label: '채널명순' },
  { value: 'duration', label: '길이순' },
  { value: 'category', label: '영상 종류순' },
];

const WATCH_ITEMS = [
  { value: 'all', label: '시청 여부 전체' },
  { value: 'unwatched', label: '안 본 영상' },
  { value: 'partial', label: '보다 만 영상' },
  { value: 'watched', label: '다 본 영상' },
];

// Every category found in the list, between "all" and the two special
// filters. A category chosen earlier stays in the menu even when the current
// list has none of it.
const buildCategoryItems = ({ categoryOptions, categoryFilter, categoryNames }) => {
  const items = categoryOptions.map(({ categoryId, name }) => ({ value: categoryId, label: name }));
  const special = [CATEGORY_FILTER_ALL, CATEGORY_FILTER_NOT_MUSIC, CATEGORY_FILTER_UNKNOWN];

  if (!special.includes(categoryFilter) && !items.some((item) => item.value === categoryFilter)) {
    items.push({ value: categoryFilter, label: readCategoryName(categoryFilter, categoryNames) });
  }

  return [
    { value: CATEGORY_FILTER_ALL, label: '모든 영상 종류' },
    ...items,
    { value: CATEGORY_FILTER_NOT_MUSIC, label: '음악 제외' },
    { value: CATEGORY_FILTER_UNKNOWN, label: '종류 미확인' },
  ];
};

// Search and every view option on one line that wraps when the panel is
// narrow. Folding it away keeps whatever it currently filters.
export function FilterBar({
  open,
  query,
  onQueryChange,
  prefs,
  sortBy,
  durationFilter,
  onPrefsChange,
  buckets,
  hasApiKey,
  categoryOptions,
  categoryNames,
  canFetchInfo,
  infoRefresh,
  infoNote,
  onFetchInfo,
}) {
  const durationItems = [{ value: 'all', label: '모든 길이' }, ...buckets.map((bucket) => ({ value: bucket.key, label: bucket.label }))];
  const sortItems = SORT_ITEMS.map((item) => ({ ...item, disabled: !hasApiKey && INFO_SORTS.includes(item.value) }));
  const categoryItems = buildCategoryItems({ categoryOptions, categoryFilter: prefs.categoryFilter, categoryNames });
  const ascending = prefs.sortDir === 'asc';
  let infoTip = '설정에 API 키를 넣으면 쓸 수 있습니다';

  if (hasApiKey) {
    infoTip = infoRefresh ? '모든 영상의 조회수를 새로 가져옵니다' : 'YouTube Data API로 영상 종류, 게시일, 조회수를 가져옵니다';
  }

  return (
    <section id="filter-panel" className="filter-bar" aria-label="검색과 필터" hidden={!open}>
      <div className="filter-row">
        <TextField
          className="filter-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="제목, 채널 검색"
          aria-label="제목 또는 채널 검색"
          autoComplete="off"
          spellCheck={false}
          startIcon={<SearchIcon />}
        />
        <div className="filter-pair">
          <Select aria-label="정렬과 분류" items={sortItems} value={sortBy} onValueChange={(value) => onPrefsChange({ sortBy: value })} />
          <Tooltip content={ascending ? '오름차순' : '내림차순'}>
            <IconButton
              variant="outline"
              icon={ascending ? <ArrowUpIcon /> : <ArrowDownIcon />}
              label={ascending ? '오름차순. 눌러서 내림차순으로 바꾸기' : '내림차순. 눌러서 오름차순으로 바꾸기'}
              onClick={() => onPrefsChange({ sortDir: ascending ? 'desc' : 'asc' })}
            />
          </Tooltip>
        </div>
        <Select aria-label="길이" items={durationItems} value={durationFilter} onValueChange={(value) => onPrefsChange({ durationFilter: value })} />
        <Select aria-label="시청 여부" items={WATCH_ITEMS} value={prefs.watchFilter} onValueChange={(value) => onPrefsChange({ watchFilter: value })} />
        <div className="filter-pair">
          <Select
            aria-label="영상 종류"
            items={categoryItems}
            value={hasApiKey ? prefs.categoryFilter : CATEGORY_FILTER_ALL}
            onValueChange={(value) => onPrefsChange({ categoryFilter: String(value) })}
            disabled={!hasApiKey}
          />
          <Tooltip content={infoTip}>
            <Button variant="outline" onClick={onFetchInfo} disabled={!canFetchInfo} focusableWhenDisabled>
              {infoRefresh ? '조회수 새로고침' : '영상 정보 가져오기'}
            </Button>
          </Tooltip>
        </div>
      </div>
      {infoNote && <p className="hint">{infoNote}</p>}
    </section>
  );
}
