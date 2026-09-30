import { Button, Shortcut } from 'neba';

import { formatCount } from '../lib/format.js';

import { TrashIcon } from './icons.jsx';

export function SelectionBar({ selectedCount, totalCount, busy, onSelectAll, onClear, onRemove }) {
  return (
    <section className="selection-bar" aria-label="선택">
      <p className="selection-count">선택 {formatCount(selectedCount)}개</p>
      <p className="selection-hint">
        <Shortcut size="xs" keys="Shift" /> 클릭 범위 선택 · <Shortcut size="xs" keys="Mod+A" /> 모두 선택 · <Shortcut size="xs" keys="Esc" /> 해제
      </p>
      <div className="selection-actions">
        <Button size="xs" variant="outline" onClick={onSelectAll} disabled={totalCount === 0}>전체 선택</Button>
        <Button size="xs" variant="outline" onClick={onClear} disabled={selectedCount === 0}>선택 해제</Button>
        <Button size="xs" variant="solid" color="danger" startIcon={<TrashIcon />} onClick={onRemove} disabled={busy || selectedCount === 0}>
          선택 항목 삭제
        </Button>
      </div>
    </section>
  );
}
