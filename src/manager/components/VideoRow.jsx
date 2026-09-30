import { Checkbox, Chip } from 'neba';
import { memo } from 'react';

import { toVideoUrl } from '../lib/export.js';
import { formatDuration } from '../lib/format.js';

// One video in the list. Clicking anywhere on the row except its link and
// its checkbox toggles the selection, like clicking the checkbox.
export const VideoRow = memo(function VideoRow({ item, index, top, height, setSize, selected, failure, isMusic, onToggle }) {
  const title = item.title || '(제목 없음)';

  const handleClick = (event) => {
    if (event.target.closest('a, button, input, [role="checkbox"]')) {
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
        <a className="video-title" href={toVideoUrl(item.videoId)} target="_blank" rel="noopener noreferrer" title={item.title}>
          {title}
        </a>
        <div className="video-meta">
          <span className="video-channel">{item.channelName || '채널 정보 없음'}</span>
          <span className="video-number">{item.durationText || formatDuration(item.durationSeconds) || '길이 정보 없음'}</span>
          <span className="video-number">#{item.position}</span>
          {isMusic && <Chip size="xs" color="success" variant="outline">음악</Chip>}
          {failure && <Chip size="xs" color="danger" variant="outline" title={failure}>삭제 실패</Chip>}
        </div>
      </div>
    </div>
  );
});
