import { Badge, Button, IconButton, Menu, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator, Tooltip } from 'neba';

import { t } from '../../i18n/runtime.js';

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
  const filterLabel = t(filtersOpen ? 'header.filters-collapse' : 'header.filters-expand');

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
              aria-label={t('source.switch-label', { title: sourceTitle })}
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
          <MenuItem onClick={onAddPlaylist}>{t('source.add')}</MenuItem>
          {canForget && <MenuItem color="danger" onClick={onForgetSource}>{t('source.forget')}</MenuItem>}
        </Menu>
      </div>
      <div className="app-header-actions">
        <Button variant="solid" color="primary" startIcon={<ScanIcon />} onClick={onScan} disabled={busy}>
          {t('common.scan')}
        </Button>
        <Menu
          disabled={busy || !hasItems}
          trigger={(
            <Button variant="outline" startIcon={<DownloadIcon />} disabled={busy || !hasItems}>
              {t('header.export')}
            </Button>
          )}
        >
          <MenuItem onClick={() => onExport('json')}>{t('header.export-json')}</MenuItem>
          <MenuItem onClick={() => onExport('csv')}>{t('header.export-csv')}</MenuItem>
        </Menu>
        <Badge dot color="primary" invisible={filtersOpen || !filtersActive} label={t('header.filters-active')}>
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
        <Tooltip content={t('common.settings')}>
          <IconButton variant="text" icon={<SettingsIcon />} label={t('common.settings')} onClick={onOpenSettings} disabled={busy} />
        </Tooltip>
        {!isTabView && (
          <Tooltip content={t('header.open-tab')}>
            <IconButton variant="text" icon={<WindowIcon />} label={t('header.open-tab')} onClick={onOpenInTab} />
          </Tooltip>
        )}
      </div>
    </header>
  );
}
