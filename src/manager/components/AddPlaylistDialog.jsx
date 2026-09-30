import { Button, Dialog, TextField } from 'neba';
import { useEffect, useState } from 'react';

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
      title="재생목록 스캔"
      showClose
      locale="ko"
      width="min(460px, calc(100vw - 24px))"
      actions={(
        <>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button variant="solid" color="primary" onClick={handleSubmit}>스캔 시작</Button>
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
          label="재생목록 주소 또는 ID"
          description="YouTube에서 재생목록을 열고 주소창의 주소를 붙여 넣으세요. 내 재생목록이면 영상을 삭제할 수도 있습니다."
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
