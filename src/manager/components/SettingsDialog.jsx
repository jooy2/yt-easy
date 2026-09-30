import { Alert, Button, Dialog, NumberField, TextField } from 'neba';
import { useEffect, useState } from 'react';

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
      title="설정"
      showClose
      locale="ko"
      width="min(460px, calc(100vw - 24px))"
      actions={(
        <>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button variant="solid" color="primary" onClick={handleSave} loading={saving}>저장</Button>
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
          label="재생시간 구간 경계 (분)"
          description="쉼표로 구분합니다. 5, 20, 60이면 5분 미만, 5–20분, 20–60분, 60분 이상으로 나눕니다."
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
            label="삭제 간격 최소 (초)"
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
            label="최대 (초)"
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
        <p className="hint">한 건을 삭제할 때마다 이 범위에서 무작위로 기다립니다. 1초보다 짧게는 설정할 수 없습니다.</p>
        <NumberField
          label="테스트 모드 기본 개수"
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
          label="YouTube Data API 키 (선택)"
          description="음악 카테고리를 조회할 때만 씁니다. 키는 이 Chrome 프로필의 확장 프로그램 저장소에 저장되고, 저장할 때 www.googleapis.com 접근 권한을 요청합니다. 비워 두고 저장하면 키와 권한을 지웁니다."
          autoComplete="off"
          spellCheck={false}
          value={form.apiKey}
          onChange={(event) => setField('apiKey', event.target.value)}
          error={errors.apiKey}
          invalid={Boolean(errors.apiKey)}
          fullWidth
        />
        {message && <Alert color="danger">{message}</Alert>}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
