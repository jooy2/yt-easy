import { Checkbox } from 'neba';

import { t } from '../../i18n/runtime.js';
import { formatTotalDuration } from '../lib/format.js';

// The heading of the list pane: what is shown, and a checkbox that selects
// or clears every video in it.
export function ListHeader({ title, count, totalSeconds, coverage, onToggleAll }) {
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
    </div>
  );
}
