import { Checkbox, Chip, IconButton, Tooltip, VisuallyHidden } from 'neba';
import { memo } from 'react';

import { t } from '../../i18n/runtime.js';
import { formatDuration } from '../lib/format.js';
import { toThumbnailUrl } from '../lib/snapshot.js';

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
  categoryName,
  extra,
  openDisabled,
  onSelect,
  onOpen,
  onOpenNewTab,
}) {
  const title = item.title || t('common.untitled');

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
      <Checkbox checked={selected} onCheckedChange={() => onSelect(item.videoId, { range: false })} aria-label={t('row.select', { title })} />
      <div className="video-thumb">
        <img src={toThumbnailUrl(item.videoId)} alt="" width="96" height="54" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        {item.watchedPercent > 0 && (
          <span className="video-progress" aria-hidden="true">
            <span style={{ width: `${item.watchedPercent}%` }} />
          </span>
        )}
      </div>
      <div className="video-text">
        <p className="video-title" title={item.title}>{title}</p>
        <div className="video-meta">
          <span className="video-channel">{item.channelName || t('common.no-channel')}</span>
          <span className="video-number">{item.durationText || formatDuration(item.durationSeconds) || t('duration.unknown')}</span>
          <span className="video-number">#{item.position}</span>
          {extra && <span className="video-number">{extra}</span>}
          {item.watchedPercent > 0 && <VisuallyHidden>{t('row.watched', { percent: item.watchedPercent })}</VisuallyHidden>}
          {categoryName && <Chip className="video-category" size="xs" variant="outline" title={t('category.badge-title', { name: categoryName })}>{categoryName}</Chip>}
          {failure && <Chip size="xs" color="danger" variant="outline" title={failure}>{t('row.failed')}</Chip>}
        </div>
      </div>
      <div className="video-actions">
        <Tooltip content={t('row.open-current')}>
          <IconButton
            size="sm"
            variant="text"
            icon={<PlayIcon />}
            label={t('row.open-current-label', { title })}
            onClick={() => onOpen(item.videoId)}
            disabled={openDisabled}
          />
        </Tooltip>
        <Tooltip content={t('row.open-new')}>
          <IconButton
            size="sm"
            variant="text"
            icon={<ExternalIcon />}
            label={t('row.open-new-label', { title })}
            onClick={() => onOpenNewTab(item.videoId)}
          />
        </Tooltip>
      </div>
    </div>
  );
});
