import { Button, Dialog, NumberField, ScrollArea, Switch } from 'neba';
import { useEffect, useRef, useState } from 'react';

import { locale, t, tParts } from '../../i18n/runtime.js';
import { SETTINGS_LIMITS } from '../lib/settings.js';

const PREVIEW_LIMIT = 50;

// Confirms a removal. Focus starts on Cancel, the safe choice.
export function RemoveDialog({ open, items, listTitle, defaultTestCount, onClose, onConfirm }) {
  const [testMode, setTestMode] = useState(false);
  const [testCount, setTestCount] = useState(defaultTestCount);
  const [dryRun, setDryRun] = useState(false);
  const [backup, setBackup] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTestMode(false);
      setTestCount(defaultTestCount);
      setDryRun(false);
      setBackup(false);
    }
  }, [open, defaultTestCount]);

  const countValid = Number.isInteger(testCount) && testCount >= 1 && testCount <= SETTINGS_LIMITS.testModeMax;

  const handleConfirm = () => {
    if (testMode && !countValid) {
      return;
    }

    onConfirm({ targets: testMode ? items.slice(0, testCount) : items, dryRun, backup: backup && !dryRun });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('remove.title')}
      showClose
      locale={locale}
      width="min(480px, calc(100vw - 24px))"
      initialFocus={cancelRef}
      actions={(
        <>
          <Button ref={cancelRef} variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="solid" color={dryRun ? 'primary' : 'danger'} onClick={handleConfirm} disabled={testMode && !countValid}>
            {t(dryRun ? 'remove.start-dry' : 'remove.start')}
          </Button>
        </>
      )}
    >
      <div className="dialog-form">
        <p>{t('remove.summary', { count: items.length, title: listTitle })}</p>
        <ScrollArea maxHeight={180} className="preview-box" label={t('remove.preview-label')}>
          <ul className="preview-list">
            {items.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={item.videoId}>{item.title || item.videoId} · {item.channelName || t('common.no-channel')}</li>
            ))}
            {items.length > PREVIEW_LIMIT && <li>{t('remove.more', { count: items.length - PREVIEW_LIMIT })}</li>}
          </ul>
        </ScrollArea>
        <Switch
          label={t('remove.test-mode')}
          checked={testMode}
          onCheckedChange={setTestMode}
        />
        {testMode && (
          <NumberField
            label={t('remove.test-count')}
            min={1}
            max={SETTINGS_LIMITS.testModeMax}
            step={1}
            value={testCount}
            onValueChange={setTestCount}
            invalid={!countValid}
            error={countValid ? undefined : t('remove.test-count-error', { max: SETTINGS_LIMITS.testModeMax })}
          />
        )}
        <Switch
          label={t('remove.dry-run')}
          checked={dryRun}
          onCheckedChange={setDryRun}
        />
        <Switch
          label={t('remove.backup')}
          description={tParts('remove.backup-desc', { folder: <code key="folder">yt-easy</code> })}
          checked={backup && !dryRun}
          onCheckedChange={setBackup}
          disabled={dryRun}
        />
        <p className="hint">{t('remove.hint')}</p>
      </div>
    </Dialog>
  );
}
