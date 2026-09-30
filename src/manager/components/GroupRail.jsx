import { Segment, SegmentedButton, Tab, Tabs } from 'neba';

import { formatCount } from '../lib/format.js';

export const ALL_GROUP_KEY = 'all';

// Channels or length ranges as vertical tabs. Choosing one shows only its
// videos beside the rail. The rail is one tab stop; the arrow keys move
// between groups, as in any tab list. Channels can be ordered by name or by
// how many videos each has.
export function GroupRail({ grouping, groups, totalCount, activeKey, onSelect, channelOrder, onChannelOrderChange }) {
  return (
    <div className="group-rail-pane">
      {grouping === 'channel' && (
        <SegmentedButton
          className="rail-order"
          size="xs"
          fullWidth
          value={channelOrder}
          onValueChange={(value) => value && onChannelOrderChange(value)}
          aria-label="채널 순서"
        >
          <Segment value="name">이름순</Segment>
          <Segment value="count" title="영상이 많은 채널부터">많은 순</Segment>
        </SegmentedButton>
      )}
      <Tabs
        className="group-rail"
        orientation="vertical"
        variant="text"
        overflow="scroll"
        activateOnFocus
        value={activeKey}
        onValueChange={(value) => onSelect(value ?? ALL_GROUP_KEY)}
        aria-label={grouping === 'channel' ? '채널' : '길이 구간'}
      >
        <Tab value={ALL_GROUP_KEY} endIcon={<span className="rail-count">{formatCount(totalCount)}</span>}>
          <span className="rail-label">전체</span>
        </Tab>
        {groups.map((group) => (
          <Tab
            key={group.key}
            value={group.key}
            title={group.label}
            endIcon={<span className="rail-count">{formatCount(group.count)}</span>}
          >
            <span className="rail-label">{group.label}</span>
          </Tab>
        ))}
      </Tabs>
    </div>
  );
}
