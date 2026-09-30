import { Button, IconButton, Tooltip } from 'neba';

import { DownloadIcon, ScanIcon, SettingsIcon, WindowIcon } from './icons.jsx';

export function AppHeader({ isTabView, busy, hasItems, onScan, onExport, onOpenSettings, onOpenInTab }) {
  return (
    <header className="app-header">
      <div className="app-header-top">
        <h1 className="app-title">나중에 볼 동영상</h1>
        <div className="app-header-tools">
          {!isTabView && (
            <Tooltip content="새 탭에서 열기">
              <IconButton variant="text" icon={<WindowIcon />} label="새 탭에서 열기" onClick={onOpenInTab} />
            </Tooltip>
          )}
          <Tooltip content="설정">
            <IconButton variant="text" icon={<SettingsIcon />} label="설정" onClick={onOpenSettings} disabled={busy} />
          </Tooltip>
        </div>
      </div>
      <div className="app-actions">
        <Button variant="solid" color="primary" startIcon={<ScanIcon />} onClick={onScan} disabled={busy}>
          목록 수집
        </Button>
        <Button variant="outline" startIcon={<DownloadIcon />} onClick={() => onExport('json')} disabled={busy || !hasItems}>
          JSON 내보내기
        </Button>
        <Button variant="outline" startIcon={<DownloadIcon />} onClick={() => onExport('csv')} disabled={busy || !hasItems}>
          CSV 내보내기
        </Button>
      </div>
    </header>
  );
}
