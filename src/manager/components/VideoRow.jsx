import { Checkbox, Chip, IconButton, Tooltip, VisuallyHidden } from 'neba';
import { memo } from 'react';

import { formatDuration } from '../lib/format.js';

import { ExternalIcon, PlayIcon } from './icons.jsx';

// One video in the list. Clicking the row, or its checkbox, selects it, and
// Shift+click selects a range. The two buttons at the end open the video, so
// opening never changes the selection.
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
  onSelect,
  onOpen,
  onOpenNewTab,
}) {
  const title = item.title || '(제목 없음)';

  // Handled in the capture phase so a click on the checkbox also sees the
  // Shift key, and so the checkbox does not toggle a second time.
  const handleClickCapture = (event) => {
    if (event.target.closest('.video-actions')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelect(item.videoId, { range: event.shiftKey });
  };

  // Shift+click would otherwise select the text between the two clicks.
  const handleMouseDown = (event) => {
    if (event.shiftKey) {
      event.preventDefault();
    }
  };

  return (
    <div
      role="listitem"
      aria-posinset={index + 1}
      aria-setsize={setSize}
      className={selected ? 'video-row is-selected' : 'video-row'}
      style={{ transform: `translateY(${top}px)`, height }}
      onClickCapture={handleClickCapture}
      onMouseDown={handleMouseDown}
    >
      <Checkbox checked={selected} onCheckedChange={() => onSelect(item.videoId, { range: false })} aria-label={`선택: ${title}`} />
      <div className="video-thumb">
        <img src={item.thumbnail} alt="" width="96" height="54" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        {item.watchedPercent > 0 && (
          <span className="video-progress" aria-hidden="true">
            <span style={{ width: `${item.watchedPercent}%` }} />
          </span>
        )}
      </div>
      <div className="video-text">
        <p className="video-title" title={item.title}>{title}</p>
        <div className="video-meta">
          <span className="video-channel">{item.channelName || '채널 정보 없음'}</span>
          <span className="video-number">{item.durationText || formatDuration(item.durationSeconds) || '길이 정보 없음'}</span>
          <span className="video-number">#{item.position}</span>
          {item.watchedPercent > 0 && <VisuallyHidden>{item.watchedPercent}% 시청</VisuallyHidden>}
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
