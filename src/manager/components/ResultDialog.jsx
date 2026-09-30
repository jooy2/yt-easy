import { Button, Dialog, ScrollArea } from 'neba';

import { locale, t } from '../../i18n/runtime.js';

const describe = ({ outcome, targets, dryRun }) => {
  const failed = outcome.results.filter((result) => !result.ok);
  const succeeded = outcome.results.length - failed.length;
  const skipped = targets.length - outcome.results.length;
  const counts = [t(dryRun ? 'result.ok' : 'result.removed', { count: succeeded }), t('result.failed', { count: failed.length })];
  const lines = [];

  if (skipped > 0) {
    counts.push(t('result.skipped', { count: skipped }));
  }

  if (outcome.cancelled) {
    lines.push(t('result.cancelled'));
  }

  if (outcome.stopReason) {
    lines.push(outcome.stopReason);
  }

  lines.push(`${counts.join(' · ')}.`);

  if (dryRun && failed.length === 0 && skipped === 0) {
    lines.push(t('result.dry-ok'));
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
      title={t(result.dryRun ? 'result.title-dry' : 'result.title')}
      showClose
      locale={locale}
      width="min(480px, calc(100vw - 24px))"
      actions={(
        <>
          {failed.length > 0 && (
            <Button variant="outline" onClick={() => onSelectFailed(failed.map((entry) => entry.videoId))}>{t('result.select-failed')}</Button>
          )}
          <Button variant="solid" color="primary" onClick={onClose}>{t('common.close')}</Button>
        </>
      )}
    >
      <div className="dialog-form">
        <p>{text}</p>
        {failed.length > 0 && (
          <>
            <h3 className="subheading">{t('result.failed-heading')}</h3>
            <ScrollArea maxHeight={200} className="preview-box" label={t('result.failed-heading')}>
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
