import { Button, Empty } from 'neba';

import { ListIcon, ScanIcon } from './icons.jsx';

// What the list area shows when there is nothing to list.
export function EmptyState({ reason, busy, onScan }) {
  if (reason === 'filtered') {
    return <Empty className="empty-state" icon={<ListIcon />} title="조건에 맞는 영상이 없습니다" locale="ko" />;
  }

  if (reason === 'empty') {
    return <Empty className="empty-state" icon={<ListIcon />} title="나중에 볼 동영상 목록이 비어 있습니다" locale="ko" />;
  }

  return (
    <Empty
      className="empty-state"
      icon={<ListIcon />}
      title="아직 수집한 목록이 없습니다"
      locale="ko"
      action={(
        <Button variant="solid" color="primary" startIcon={<ScanIcon />} onClick={onScan} disabled={busy}>
          목록 수집
        </Button>
      )}
    >
      YouTube에 로그인한 상태에서 목록을 수집하세요.
    </Empty>
  );
}
