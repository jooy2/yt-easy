import { Button, Dialog, ScrollArea } from 'neba';

import { formatCount } from '../lib/format.js';

const describe = ({ outcome, targets, dryRun }) => {
  const failed = outcome.results.filter((result) => !result.ok);
  const succeeded = outcome.results.length - failed.length;
  const skipped = targets.length - outcome.results.length;
  const counts = [dryRun ? `정상 ${formatCount(succeeded)}개` : `삭제 ${formatCount(succeeded)}개`, `실패 ${formatCount(failed.length)}개`];
  const lines = [];

  if (skipped > 0) {
    counts.push(`처리하지 않음 ${formatCount(skipped)}개`);
  }

  if (outcome.cancelled) {
    lines.push('작업을 취소했습니다.');
  }

  if (outcome.stopReason) {
    lines.push(outcome.stopReason);
  }

  lines.push(`${counts.join(' · ')}.`);

  if (dryRun && failed.length === 0 && skipped === 0) {
    lines.push('모든 항목에서 삭제 메뉴를 찾았습니다. 드라이런을 끄고 실제로 삭제할 수 있습니다.');
  }

  return { text: lines.join(' '), failed };
};

export function ResultDialog({ result, onClose, onSelectFailed }) {
  if (!result) {
    return null;
  }

  const { text, failed } = describe(result);
  const titles = new Map(result.targets.map((item) => [item.videoId, item.title || item.videoId]));

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={result.dryRun ? '드라이런 결과' : '삭제 결과'}
      showClose
      locale="ko"
      width="min(480px, calc(100vw - 24px))"
      actions={(
        <>
          {failed.length > 0 && (
            <Button variant="outline" onClick={() => onSelectFailed(failed.map((entry) => entry.videoId))}>실패 항목만 선택</Button>
          )}
          <Button variant="solid" color="primary" onClick={onClose}>닫기</Button>
        </>
      )}
    >
      <div className="dialog-form">
        <p>{text}</p>
        {failed.length > 0 && (
          <>
            <h3 className="subheading">실패한 항목</h3>
            <ScrollArea maxHeight={200} className="preview-box" label="실패한 항목">
              <ul className="preview-list">
                {failed.map((entry) => (
                  <li key={entry.videoId}>
                    {titles.get(entry.videoId)} <span className="reason">({entry.reason})</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </>
        )}
      </div>
    </Dialog>
  );
}
