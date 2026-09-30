import { Alert, Button, Dialog, NumberField, TextField } from 'neba';
import { useEffect, useState } from 'react';

import { locale, t } from '../../i18n/runtime.js';
import { SETTINGS_LIMITS, formatBounds, validateSettingsForm } from '../lib/settings.js';

const toForm = (settings) => ({
  boundsText: formatBounds(settings.durationBounds),
  delayMin: settings.removeDelayMin,
  delayMax: settings.removeDelayMax,
  testModeCount: settings.testModeCount,
  apiKey: settings.apiKey,
});

// `onSave` resolves with an error message to show, or null once saved.
export function SettingsDialog({ open, settings, onClose, onSave }) {
  const [form, setForm] = useState(() => toForm(settings));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toForm(settings));
      setErrors({});
      setMessage('');
    }
  }, [open, settings]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    const { settings: next, errors: found } = validateSettingsForm({
      boundsText: form.boundsText,
      delayMin: form.delayMin ?? '',
      delayMax: form.delayMax ?? '',
      testModeCount: form.testModeCount ?? '',
      apiKey: form.apiKey,
    });

    if (found) {
      setErrors(found);
      return;
    }

    setErrors({});
    setMessage('');
    setSaving(true);

    // `onSave` asks for a permission first thing, while this click still
    // counts as the user gesture Chrome requires for the prompt.
    const failure = await onSave(next);

    setSaving(false);

    if (failure) {
      setMessage(failure);
    } else {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('common.settings')}
      showClose
      locale={locale}
      width="min(460px, calc(100vw - 24px))"
      actions={(
        <>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="solid" color="primary" onClick={handleSave} loading={saving}>{t('common.save')}</Button>
        </>
      )}
    >
      <form
        className="dialog-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <TextField
          label={t('settings.bounds-label')}
          description={t('settings.bounds-desc')}
          inputMode="numeric"
          autoComplete="off"
          value={form.boundsText}
          onChange={(event) => setField('boundsText', event.target.value)}
          error={errors.bounds}
          invalid={Boolean(errors.bounds)}
          fullWidth
        />
        <div className="field-pair">
          <NumberField
            label={t('settings.delay-min-label')}
            min={SETTINGS_LIMITS.delayMin}
            max={SETTINGS_LIMITS.delayMax}
            step={0.1}
            value={form.delayMin}
            onValueChange={(value) => setField('delayMin', value)}
            error={errors.delayMin}
            invalid={Boolean(errors.delayMin)}
            fullWidth
          />
          <NumberField
            label={t('settings.delay-max-label')}
            min={SETTINGS_LIMITS.delayMin}
            max={SETTINGS_LIMITS.delayMax}
            step={0.1}
            value={form.delayMax}
            onValueChange={(value) => setField('delayMax', value)}
            error={errors.delayMax}
            invalid={Boolean(errors.delayMax)}
            fullWidth
          />
        </div>
        <p className="hint">{t('settings.delay-hint')}</p>
        <NumberField
          label={t('settings.test-count-label')}
          min={1}
          max={SETTINGS_LIMITS.testModeMax}
          step={1}
          value={form.testModeCount}
          onValueChange={(value) => setField('testModeCount', value)}
          error={errors.testModeCount}
          invalid={Boolean(errors.testModeCount)}
          fullWidth
        />
        <TextField
          type="password"
          label={t('settings.api-key-label')}
          description={t('settings.api-key-desc')}
          autoComplete="off"
          spellCheck={false}
          value={form.apiKey}
          onChange={(event) => setField('apiKey', event.target.value)}
          error={errors.apiKey}
          invalid={Boolean(errors.apiKey)}
          fullWidth
        />
        {message && <Alert color="danger" locale={locale}>{message}</Alert>}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
