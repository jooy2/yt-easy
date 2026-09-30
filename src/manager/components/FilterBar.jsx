import { Button, IconButton, Select, TextField, Tooltip } from 'neba';

import { t } from '../../i18n/runtime.js';
import {
  CATEGORY_FILTER_ALL,
  CATEGORY_FILTER_NOT_MUSIC,
  CATEGORY_FILTER_UNKNOWN,
  INFO_SORTS,
  readCategoryName,
} from '../lib/view-model.js';

import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from './icons.jsx';

// Sorting by channel name, length, or category also lists the channels, the
// length ranges, or the categories beside the videos. "Date added" is the
// order of the list on YouTube.
const SORT_ITEMS = [
  { value: 'position', label: t('sort.position') },
  { value: 'published', label: t('sort.published') },
  { value: 'views', label: t('sort.views') },
  { value: 'channel', label: t('sort.channel') },
  { value: 'duration', label: t('sort.duration') },
  { value: 'category', label: t('sort.category') },
];

const WATCH_ITEMS = [
  { value: 'all', label: t('watch.all') },
  { value: 'unwatched', label: t('watch.unwatched') },
  { value: 'partial', label: t('watch.partial') },
  { value: 'watched', label: t('watch.watched') },
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
    { value: CATEGORY_FILTER_ALL, label: t('category.all') },
    ...items,
    { value: CATEGORY_FILTER_NOT_MUSIC, label: t('category.not-music') },
    { value: CATEGORY_FILTER_UNKNOWN, label: t('category.unknown') },
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
  const durationItems = [{ value: 'all', label: t('filter.duration-all') }, ...buckets.map((bucket) => ({ value: bucket.key, label: bucket.label }))];
  const sortItems = SORT_ITEMS.map((item) => ({ ...item, disabled: !hasApiKey && INFO_SORTS.includes(item.value) }));
  const categoryItems = buildCategoryItems({ categoryOptions, categoryFilter: prefs.categoryFilter, categoryNames });
  const ascending = prefs.sortDir === 'asc';
  let infoTip = t('filter.info-tip-no-key');

  if (hasApiKey) {
    infoTip = t(infoRefresh ? 'filter.info-tip-refresh' : 'filter.info-tip-fetch');
  }

  return (
    <section id="filter-panel" className="filter-bar" aria-label={t('filter.panel-label')} hidden={!open}>
      <div className="filter-row">
        <TextField
          className="filter-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('filter.search-placeholder')}
          aria-label={t('filter.search-label')}
          autoComplete="off"
          spellCheck={false}
          startIcon={<SearchIcon />}
        />
        <div className="filter-pair">
          <Select aria-label={t('filter.sort-label')} items={sortItems} value={sortBy} onValueChange={(value) => onPrefsChange({ sortBy: value })} />
          <Tooltip content={t(ascending ? 'filter.ascending' : 'filter.descending')}>
            <IconButton
              variant="outline"
              icon={ascending ? <ArrowUpIcon /> : <ArrowDownIcon />}
              label={t(ascending ? 'filter.ascending-action' : 'filter.descending-action')}
              onClick={() => onPrefsChange({ sortDir: ascending ? 'desc' : 'asc' })}
            />
          </Tooltip>
        </div>
        <Select aria-label={t('filter.duration-label')} items={durationItems} value={durationFilter} onValueChange={(value) => onPrefsChange({ durationFilter: value })} />
        <Select aria-label={t('filter.watch-label')} items={WATCH_ITEMS} value={prefs.watchFilter} onValueChange={(value) => onPrefsChange({ watchFilter: value })} />
        <div className="filter-pair">
          <Select
            aria-label={t('filter.category-label')}
            items={categoryItems}
            value={hasApiKey ? prefs.categoryFilter : CATEGORY_FILTER_ALL}
            onValueChange={(value) => onPrefsChange({ categoryFilter: String(value) })}
            disabled={!hasApiKey}
          />
          <Tooltip content={infoTip}>
            <Button variant="outline" onClick={onFetchInfo} disabled={!canFetchInfo} focusableWhenDisabled>
              {t(infoRefresh ? 'filter.info-refresh' : 'filter.info-fetch')}
            </Button>
          </Tooltip>
        </div>
      </div>
      {infoNote && <p className="hint">{infoNote}</p>}
    </section>
  );
}
