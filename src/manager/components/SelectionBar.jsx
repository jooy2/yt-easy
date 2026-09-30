import { Button, Shortcut, Tooltip } from 'neba';

import { t, tParts } from '../../i18n/runtime.js';

import { TrashIcon } from './icons.jsx';

// `canRemove` is false for a list whose videos cannot be removed here, such
// as another person's playlist.
export function SelectionBar({ selectedCount, totalCount, busy, canRemove, onSelectAll, onClear, onRemove }) {
  const removeButton = (
    <Button
      size="xs"
      variant="solid"
      color="danger"
      startIcon={<TrashIcon />}
      onClick={onRemove}
      disabled={busy || selectedCount === 0 || !canRemove}
      focusableWhenDisabled={!canRemove}
    >
      {t('selection.remove')}
    </Button>
  );

  return (
    <section className="selection-bar" aria-label={t('selection.label')}>
      <p className="selection-count">{t('selection.count', { count: selectedCount })}</p>
      <p className="selection-hint">
        {tParts('selection.hint', {
          shift: <Shortcut key="shift" size="xs" keys="Shift" />,
          all: <Shortcut key="all" size="xs" keys="Mod+A" />,
          esc: <Shortcut key="esc" size="xs" keys="Esc" />,
        })}
      </p>
      <div className="selection-actions">
        <Button size="xs" variant="outline" onClick={onSelectAll} disabled={totalCount === 0}>{t('selection.select-all')}</Button>
        <Button size="xs" variant="outline" onClick={onClear} disabled={selectedCount === 0}>{t('selection.clear')}</Button>
        {canRemove ? removeButton : (
          <Tooltip content={t('selection.remove-unavailable')}>
            {removeButton}
          </Tooltip>
        )}
      </div>
    </section>
  );
}
