import { Checkbox, Chip, IconButton, Tooltip } from 'neba';
import { memo } from 'react';

import { formatDuration } from '../lib/format.js';

import { ExternalIcon, PlayIcon } from './icons.jsx';

// One video in the list. Clicking the row selects it; the two buttons at the
// end open the video, so opening never changes the selection.
export const VideoRow = memo(function VideoRow({
  item,
  index,
  top,
  height,
  setSize,
  selected,
  failure,
  isMusic,
  openDisabled,
  onToggle,
  onOpen,
  onOpenNewTab,
}) {
  const title = item.title || '(제목 없음)';

  const handleClick = (event) => {
    if (event.target.closest('button, input, [role="checkbox"]')) {
      return;
    }

    onToggle(item.videoId);
  };

  return (
    <div
      role="listitem"
      aria-posinset={index + 1}
      aria-setsize={setSize}
      className={selected ? 'video-row is-selected' : 'video-row'}
      style={{ transform: `translateY(${top}px)`, height }}
      onClick={handleClick}
    >
      <Checkbox checked={selected} onCheckedChange={() => onToggle(item.videoId)} aria-label={`선택: ${title}`} />
      <img
        className="video-thumb"
        src={item.thumbnail}
        alt=""
        width="96"
        height="54"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      <div className="video-text">
        <p className="video-title" title={item.title}>{title}</p>
        <div className="video-meta">
          <span className="video-channel">{item.channelName || '채널 정보 없음'}</span>
          <span className="video-number">{item.durationText || formatDuration(item.durationSeconds) || '길이 정보 없음'}</span>
          <span className="video-number">#{item.position}</span>
          {isMusic && <Chip size="xs" color="success" variant="outline">음악</Chip>}
          {failure && <Chip size="xs" color="danger" variant="outline" title={failure}>삭제 실패</Chip>}
        </div>
      </div>
      <div className="video-actions">
        <Tooltip content="현재 탭에서 열기">
          <IconButton
            size="sm"
            variant="text"
            icon={<PlayIcon />}
            label={`현재 탭에서 열기: ${title}`}
            onClick={() => onOpen(item.videoId)}
            disabled={openDisabled}
          />
        </Tooltip>
        <Tooltip content="새 탭으로 열기">
          <IconButton
            size="sm"
            variant="text"
            icon={<ExternalIcon />}
            label={`새 탭으로 열기: ${title}`}
            onClick={() => onOpenNewTab(item.videoId)}
          />
        </Tooltip>
      </div>
    </div>
  );
});
