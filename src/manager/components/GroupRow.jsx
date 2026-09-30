import { Checkbox } from 'neba';
import { memo } from 'react';

import { formatCount, formatTotalDuration } from '../lib/format.js';

import { ChevronIcon } from './icons.jsx';

// The heading of a channel or length group. Its checkbox selects the whole
// group, and the heading folds the group away.
export const GroupRow = memo(function GroupRow({ group, index, top, height, setSize, coverage, onSelectGroup, onToggleCollapse }) {
  return (
    <div
      role="listitem"
      aria-posinset={index + 1}
      aria-setsize={setSize}
      className="group-row"
      style={{ transform: `translateY(${top}px)`, height }}
    >
      <Checkbox
        checked={coverage === 'all'}
        indeterminate={coverage === 'some'}
        onCheckedChange={(checked) => onSelectGroup(group.videoIds, checked)}
        aria-label={`${group.label} 그룹 전체 선택`}
      />
      <button type="button" className="group-toggle" aria-expanded={!group.collapsed} onClick={() => onToggleCollapse(group.key)}>
        <span className="group-caret"><ChevronIcon /></span>
        <span className="group-label">{group.label}</span>
        <span className="group-meta">{formatCount(group.count)}개 · {formatTotalDuration(group.totalSeconds)}</span>
      </button>
    </div>
  );
});
