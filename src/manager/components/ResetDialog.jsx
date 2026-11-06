import { Button, Dialog, Switch } from 'neba';
import { useEffect, useRef, useState } from 'react';

import { locale, t } from '../../i18n/runtime.js';

// Confirms a reset to the state of a new install. The settings, which hold
// the API key, stay unless the user asks for them to go too. Focus starts on
// Cancel, the safe choice.
export function ResetDialog({ open, onClose, onConfirm }) {
  const [withSettings, setWithSettings] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (open) {
      setWithSettings(false);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('reset.title')}
      showClose
      locale={locale}
      width="min(440px, calc(100vw - 24px))"
      initialFocus={cancelRef}
      actions={(
        <>
          <Button ref={cancelRef} variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="solid" color="danger" onClick={() => onConfirm({ keepSettings: !withSettings })}>{t('reset.start')}</Button>
        </>
      )}
    >
      <div className="dialog-form">
        <p>{t('reset.summary')}</p>
        <Switch label={t('reset.settings')} checked={withSettings} onCheckedChange={setWithSettings} />
      </div>
    </Dialog>
  );
}
