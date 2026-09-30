import { Badge, Button, IconButton, Menu, MenuItem, Tooltip } from 'neba';

import { DownloadIcon, FilterIcon, ScanIcon, SettingsIcon, WindowIcon } from './icons.jsx';

// One row: the title, then every action. The filter toggle carries a dot
// while filters are folded away but still narrowing the list.
export function AppHeader({ isTabView, busy, hasItems, filtersOpen, filtersActive, onToggleFilters, onScan, onExport, onOpenSettings, onOpenInTab }) {
  const filterLabel = filtersOpen ? '검색과 필터 접기' : '검색과 필터 펼치기';

  return (
    <header className="app-header">
      <h1 className="app-title">나중에 볼 동영상</h1>
      <div className="app-header-actions">
        <Button variant="solid" color="primary" startIcon={<ScanIcon />} onClick={onScan} disabled={busy}>
          스캔 시작
        </Button>
        <Menu
          disabled={busy || !hasItems}
          trigger={(
            <Button variant="outline" startIcon={<DownloadIcon />} disabled={busy || !hasItems}>
              내보내기
            </Button>
          )}
        >
          <MenuItem onClick={() => onExport('json')}>JSON 파일로 저장</MenuItem>
          <MenuItem onClick={() => onExport('csv')}>CSV 파일로 저장</MenuItem>
        </Menu>
        <Badge dot color="primary" invisible={filtersOpen || !filtersActive} label="필터 적용 중">
          <Tooltip content={filterLabel}>
            <IconButton
              variant={filtersOpen ? 'outline' : 'text'}
              icon={<FilterIcon />}
              label={filterLabel}
              aria-expanded={filtersOpen}
              aria-controls="filter-panel"
              onClick={onToggleFilters}
              disabled={!hasItems}
            />
          </Tooltip>
        </Badge>
        <Tooltip content="설정">
          <IconButton variant="text" icon={<SettingsIcon />} label="설정" onClick={onOpenSettings} disabled={busy} />
        </Tooltip>
        {!isTabView && (
          <Tooltip content="새 탭에서 열기">
            <IconButton variant="text" icon={<WindowIcon />} label="새 탭에서 열기" onClick={onOpenInTab} />
          </Tooltip>
        )}
      </div>
    </header>
  );
}
