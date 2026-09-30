import { Button, Shortcut, Tooltip } from 'neba';

import { formatCount } from '../lib/format.js';

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
      선택 항목 삭제
    </Button>
  );

  return (
    <section className="selection-bar" aria-label="선택">
      <p className="selection-count">선택 {formatCount(selectedCount)}개</p>
      <p className="selection-hint">
        <Shortcut size="xs" keys="Shift" /> 클릭 범위 선택 · <Shortcut size="xs" keys="Mod+A" /> 모두 선택 · <Shortcut size="xs" keys="Esc" /> 해제
      </p>
      <div className="selection-actions">
        <Button size="xs" variant="outline" onClick={onSelectAll} disabled={totalCount === 0}>전체 선택</Button>
        <Button size="xs" variant="outline" onClick={onClear} disabled={selectedCount === 0}>선택 해제</Button>
        {canRemove ? removeButton : (
          <Tooltip content="이 재생목록에서는 삭제할 수 없습니다. 내 재생목록과 나중에 볼 동영상만 삭제할 수 있습니다.">
            {removeButton}
          </Tooltip>
        )}
      </div>
    </section>
  );
}
