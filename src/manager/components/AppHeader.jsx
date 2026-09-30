import { Badge, Button, IconButton, Menu, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, Tooltip } from 'neba';

import { ChevronDownIcon, DownloadIcon, FilterIcon, ScanIcon, SettingsIcon, WindowIcon } from './icons.jsx';

// The list being managed, which opens a menu of the scanned lists, then
// every action. The filter toggle carries a dot while filters are folded
// away but still narrowing the list.
export function AppHeader({
  isTabView,
  busy,
  hasItems,
  sources,
  activeListId,
  sourceTitle,
  canForget,
  onSelectSource,
  onAddPlaylist,
  onForgetSource,
  filtersOpen,
  filtersActive,
  onToggleFilters,
  onScan,
  onExport,
  onOpenSettings,
  onOpenInTab,
}) {
  const filterLabel = filtersOpen ? '검색과 필터 접기' : '검색과 필터 펼치기';

  return (
    <header className="app-header">
      <div className="app-brand">
        <img className="app-logo" src="../../icons/icon-48.png" alt="" width="20" height="20" />
        <Menu
          disabled={busy}
          align="start"
          trigger={(
            <Button
              variant="text"
              className="source-button"
              endIcon={<ChevronDownIcon />}
              disabled={busy}
              aria-label={`목록 바꾸기. 지금 목록: ${sourceTitle}`}
            >
              <span className="source-title">{sourceTitle}</span>
            </Button>
          )}
        >
          <MenuRadioGroup value={activeListId} onValueChange={(value) => onSelectSource(String(value))}>
            {sources.map((source) => (
              <MenuRadioItem key={source.listId} value={source.listId} description={source.description} closeOnClick>
                {source.title}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem onClick={onAddPlaylist}>재생목록 추가…</MenuItem>
          {canForget && <MenuItem color="danger" onClick={onForgetSource}>이 목록을 기록에서 지우기</MenuItem>}
        </Menu>
      </div>
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
