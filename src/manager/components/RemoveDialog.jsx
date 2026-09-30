import { Button, Dialog, NumberField, ScrollArea, Switch } from 'neba';
import { useEffect, useRef, useState } from 'react';

import { formatCount } from '../lib/format.js';
import { SETTINGS_LIMITS } from '../lib/settings.js';

const PREVIEW_LIMIT = 50;

// Confirms a removal. Focus starts on Cancel, the safe choice.
export function RemoveDialog({ open, items, defaultTestCount, onClose, onConfirm }) {
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
      title="선택 항목 삭제"
      showClose
      locale="ko"
      width="min(480px, calc(100vw - 24px))"
      initialFocus={cancelRef}
      actions={(
        <>
          <Button ref={cancelRef} variant="outline" onClick={onClose}>취소</Button>
          <Button variant="solid" color={dryRun ? 'primary' : 'danger'} onClick={handleConfirm} disabled={testMode && !countValid}>
            {dryRun ? '확인 시작' : '삭제 시작'}
          </Button>
        </>
      )}
    >
      <div className="dialog-form">
        <p>선택한 {formatCount(items.length)}개를 나중에 볼 동영상에서 삭제합니다. 목록 순서대로 한 건씩 처리합니다.</p>
        <ScrollArea maxHeight={180} className="preview-box" label="삭제할 영상">
          <ul className="preview-list">
            {items.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={item.videoId}>{item.title || item.videoId} · {item.channelName || '채널 정보 없음'}</li>
            ))}
            {items.length > PREVIEW_LIMIT && <li>외 {formatCount(items.length - PREVIEW_LIMIT)}개</li>}
          </ul>
        </ScrollArea>
        <Switch
          label="테스트 모드: 앞에서부터 몇 개만 처리"
          checked={testMode}
          onCheckedChange={setTestMode}
        />
        {testMode && (
          <NumberField
            label="처리할 개수"
            min={1}
            max={SETTINGS_LIMITS.testModeMax}
            step={1}
            value={testCount}
            onValueChange={setTestCount}
            invalid={!countValid}
            error={countValid ? undefined : `1부터 ${SETTINGS_LIMITS.testModeMax} 사이의 정수를 입력해 주세요.`}
          />
        )}
        <Switch
          label="드라이런: 삭제 메뉴를 찾기만 하고 누르지 않음"
          checked={dryRun}
          onCheckedChange={setDryRun}
        />
        <Switch
          label="삭제 전에 대상 목록을 백업 파일로 저장"
          description={(
            <>
              JSON과 CSV 파일을 다운로드 폴더의 <code>yt-easy</code> 폴더에 저장하고, 두 파일이 모두 저장된 뒤에 삭제를 시작합니다.
            </>
          )}
          checked={backup && !dryRun}
          onCheckedChange={setBackup}
          disabled={dryRun}
        />
        <p className="hint">진행하는 동안 나중에 볼 동영상 탭이 앞으로 나옵니다. 끝날 때까지 그 탭을 화면에 띄워 두세요.</p>
      </div>
    </Dialog>
  );
}
