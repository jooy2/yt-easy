import { Button } from 'neba';

import { formatCount } from '../lib/format.js';

import { TrashIcon } from './icons.jsx';

export function SelectionBar({ selectedCount, totalCount, viewCount, busy, onSelectAll, onSelectView, onClear, onRemove }) {
  return (
    <section className="selection-bar" aria-label="선택">
      <p className="selection-count">선택 {formatCount(selectedCount)}개</p>
      <div className="selection-actions">
        <Button size="xs" variant="outline" onClick={onSelectAll} disabled={totalCount === 0}>전체 선택</Button>
        <Button size="xs" variant="outline" onClick={onSelectView} disabled={viewCount === 0}>검색 결과 선택</Button>
        <Button size="xs" variant="outline" onClick={onClear} disabled={selectedCount === 0}>선택 해제</Button>
        <Button size="xs" variant="solid" color="danger" startIcon={<TrashIcon />} onClick={onRemove} disabled={busy || selectedCount === 0}>
          선택 항목 삭제
        </Button>
      </div>
    </section>
  );
}
