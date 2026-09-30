import { Button, Dialog, TextField } from 'neba';
import { useEffect, useState } from 'react';

import { locale, t } from '../../i18n/runtime.js';
import { parsePlaylistInput } from '../lib/sources.js';

// Asks for a playlist by its address or ID, and scans it.
export function AddPlaylistDialog({ open, onClose, onSubmit }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setText('');
      setError('');
    }
  }, [open]);

  const handleSubmit = () => {
    const { listId, error: problem } = parsePlaylistInput(text);

    if (problem) {
      setError(problem);
      return;
    }

    onSubmit(listId);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t('playlist.title')}
      showClose
      locale={locale}
      width="min(460px, calc(100vw - 24px))"
      actions={(
        <>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="solid" color="primary" onClick={handleSubmit}>{t('common.scan')}</Button>
        </>
      )}
    >
      <form
        className="dialog-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <TextField
          label={t('playlist.input-label')}
          description={t('playlist.input-desc')}
          placeholder="https://www.youtube.com/playlist?list=…"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
          error={error || undefined}
          invalid={Boolean(error)}
          fullWidth
        />
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
