import { Button, IconButton, Select, TextField, Tooltip } from 'neba';

import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from './icons.jsx';

const GROUP_ITEMS = [
  { value: 'none', label: '전체 목록' },
  { value: 'channel', label: '채널별' },
  { value: 'duration', label: '길이별' },
];

const SORT_ITEMS = [
  { value: 'position', label: '추가순' },
  { value: 'duration', label: '길이순' },
  { value: 'channel', label: '채널명순' },
];

const WATCH_ITEMS = [
  { value: 'all', label: '시청 여부 전체' },
  { value: 'unwatched', label: '안 본 영상' },
  { value: 'partial', label: '보다 만 영상' },
  { value: 'watched', label: '다 본 영상' },
];

const CATEGORY_ITEMS = [
  { value: 'all', label: '음악 여부 전체' },
  { value: 'music', label: '음악' },
  { value: 'other', label: '음악 아님' },
];

// Search and every view option on one line that wraps when the panel is
// narrow. Folding it away keeps whatever it currently filters.
export function FilterBar({ open, query, onQueryChange, prefs, durationFilter, onPrefsChange, buckets, hasApiKey, canFetchCategories, categoryNote, onFetchCategories }) {
  const durationItems = [{ value: 'all', label: '모든 길이' }, ...buckets.map((bucket) => ({ value: bucket.key, label: bucket.label }))];
  const ascending = prefs.sortDir === 'asc';

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
        <Select aria-label="보기" items={GROUP_ITEMS} value={prefs.groupBy} onValueChange={(value) => onPrefsChange({ groupBy: value })} />
        <div className="filter-pair">
          <Select aria-label="정렬 기준" items={SORT_ITEMS} value={prefs.sortBy} onValueChange={(value) => onPrefsChange({ sortBy: value })} />
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
            aria-label="음악 여부"
            items={CATEGORY_ITEMS}
            value={prefs.categoryFilter}
            onValueChange={(value) => onPrefsChange({ categoryFilter: value })}
          />
          <Tooltip content={hasApiKey ? 'YouTube Data API로 카테고리 확인' : '설정에 API 키를 넣으면 쓸 수 있습니다'}>
            <Button variant="outline" onClick={onFetchCategories} disabled={!canFetchCategories} focusableWhenDisabled>
              카테고리 확인
            </Button>
          </Tooltip>
        </div>
      </div>
      {categoryNote && <p className="hint">{categoryNote}</p>}
    </section>
  );
}
