import { Button, Empty } from 'neba';

import { ListIcon, ScanIcon } from './icons.jsx';

// What the list area shows when there is nothing to list. Before the first
// scan it doubles as a short guide, so a first-time user knows where to start.
export function EmptyState({ reason, busy, listTitle, onScan }) {
  if (reason === 'filtered') {
    return <Empty className="empty-state" icon={<ListIcon />} title="조건에 맞는 영상이 없습니다" locale="ko" />;
  }

  if (reason === 'empty') {
    return <Empty className="empty-state" icon={<ListIcon />} title="목록이 비어 있습니다" locale="ko" />;
  }

  return (
    <Empty
      className="empty-state"
      icon={<ScanIcon />}
      title={`${listTitle} 목록을 스캔해 보세요`}
      locale="ko"
      action={(
        <Button size="lg" variant="solid" color="primary" startIcon={<ScanIcon />} onClick={onScan} disabled={busy}>
          스캔 시작
        </Button>
      )}
    >
      <p className="empty-lead">YouTube에 로그인한 상태에서 목록 전체를 읽어 옵니다. 영상이 수천 개면 1–2분 걸립니다. 다른 재생목록은 맨 위의 목록 이름을 눌러 고를 수 있습니다.</p>
      <ol className="empty-steps">
        <li>스캔 시작을 누릅니다.</li>
        <li>채널명순·길이순으로 나누거나 검색해서 영상을 고릅니다.</li>
        <li>선택 항목 삭제로 한 번에 지웁니다. 원하면 지우기 전에 백업 파일을 저장할 수 있습니다.</li>
      </ol>
    </Empty>
  );
}
