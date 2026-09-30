import { Segment, SegmentedButton, Tab, Tabs } from 'neba';

import { t } from '../../i18n/runtime.js';
import { formatCount } from '../lib/format.js';

export const ALL_GROUP_KEY = 'all';

const RAIL_LABELS = {
  channel: 'rail.channel',
  duration: 'rail.duration',
  category: 'rail.category',
};

// Channels, length ranges, or categories as vertical tabs. Choosing one shows
// only its videos beside the rail. The rail is one tab stop; the arrow keys
// move between groups, as in any tab list. Channels and categories can be
// ordered by name or by how many videos each has.
export function GroupRail({ grouping, groups, totalCount, activeKey, onSelect, groupOrder, onGroupOrderChange }) {
  const label = t(RAIL_LABELS[grouping]);

  return (
    <div className="group-rail-pane">
      {grouping !== 'duration' && (
        <SegmentedButton
          className="rail-order"
          size="xs"
          fullWidth
          value={groupOrder}
          onValueChange={(value) => value && onGroupOrderChange(value)}
          aria-label={t('rail.order-label', { label })}
        >
          <Segment value="name">{t('rail.by-name')}</Segment>
          <Segment value="count" title={t('rail.by-count-title')}>{t('rail.by-count')}</Segment>
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
        aria-label={label}
      >
        <Tab value={ALL_GROUP_KEY} endIcon={<span className="rail-count">{formatCount(totalCount)}</span>}>
          <span className="rail-label">{t('list.group-all')}</span>
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
