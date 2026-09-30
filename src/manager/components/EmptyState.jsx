import { Button, Empty } from 'neba';

import { ListIcon, ScanIcon } from './icons.jsx';

// What the list area shows when there is nothing to list. Before the first
// scan it doubles as a short guide, so a first-time user knows where to start.
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
      icon={<ScanIcon />}
      title="나중에 볼 동영상을 스캔해 보세요"
      locale="ko"
      action={(
        <Button size="lg" variant="solid" color="primary" startIcon={<ScanIcon />} onClick={onScan} disabled={busy}>
          스캔 시작
        </Button>
      )}
    >
      <p className="empty-lead">YouTube에 로그인한 상태에서 나중에 볼 동영상 목록 전체를 읽어 옵니다. 영상이 수천 개면 1–2분 걸립니다.</p>
      <ol className="empty-steps">
        <li>스캔 시작을 누릅니다.</li>
        <li>채널별·길이별로 나누거나 검색해서 영상을 고릅니다.</li>
        <li>선택 항목 삭제로 한 번에 지웁니다. 지우기 전에 백업 파일을 저장합니다.</li>
      </ol>
    </Empty>
  );
}
