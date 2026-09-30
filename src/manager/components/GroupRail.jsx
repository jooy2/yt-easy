import { Tab, Tabs } from 'neba';

import { formatCount } from '../lib/format.js';

export const ALL_GROUP_KEY = 'all';

// Channels or length ranges as vertical tabs. Choosing one shows only its
// videos beside the rail. The rail is one tab stop; the arrow keys move
// between groups, as in any tab list.
export function GroupRail({ groupBy, groups, totalCount, activeKey, onSelect }) {
  return (
    <Tabs
      className="group-rail"
      orientation="vertical"
      variant="text"
      overflow="scroll"
      activateOnFocus
      value={activeKey}
      onValueChange={(value) => onSelect(value ?? ALL_GROUP_KEY)}
      aria-label={groupBy === 'channel' ? '채널' : '길이 구간'}
    >
      <Tab value={ALL_GROUP_KEY} className="rail-tab" endIcon={<span className="rail-count">{formatCount(totalCount)}</span>}>
        <span className="rail-label">전체</span>
      </Tab>
      {groups.map((group) => (
        <Tab
          key={group.key}
          value={group.key}
          className="rail-tab"
          title={group.label}
          endIcon={<span className="rail-count">{formatCount(group.count)}</span>}
        >
          <span className="rail-label">{group.label}</span>
        </Tab>
      ))}
    </Tabs>
  );
}
