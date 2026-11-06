import { Checkbox, IconButton, Menu, MenuRadioGroup, MenuRadioItem } from 'neba';

import { t } from '../../i18n/runtime.js';
import { formatTotalDuration } from '../lib/format.js';

import { RowSizeIcon } from './icons.jsx';

const ROW_SIZES = [
  { value: 'small', label: t('list.row-small') },
  { value: 'medium', label: t('list.row-medium') },
  { value: 'large', label: t('list.row-large') },
];

// The heading of the list pane: what is shown, a checkbox that selects or
// clears every video in it, and the size of the rows.
export function ListHeader({ title, count, totalSeconds, coverage, onToggleAll, rowSize, onRowSizeChange }) {
  return (
    <div className="list-header">
      <Checkbox
        checked={coverage === 'all'}
        indeterminate={coverage === 'some'}
        onCheckedChange={(checked) => onToggleAll(checked)}
        disabled={count === 0}
        aria-label={t('list.select-all', { title })}
      />
      <h2 className="list-title">{title}</h2>
      <p className="list-meta">{t('list.meta', { count, duration: formatTotalDuration(totalSeconds) })}</p>
      {/* A Tooltip cannot share the trigger with a Menu, so the button names
          itself with a native title. */}
      <Menu
        align="end"
        trigger={<IconButton size="xs" variant="text" icon={<RowSizeIcon />} label={t('list.row-size')} title={t('list.row-size')} />}
      >
        <MenuRadioGroup value={rowSize} onValueChange={(value) => onRowSizeChange(String(value))}>
          {ROW_SIZES.map((size) => (
            <MenuRadioItem key={size.value} value={size.value} closeOnClick>{size.label}</MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </Menu>
    </div>
  );
}
