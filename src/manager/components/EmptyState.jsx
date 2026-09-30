import { Button, Empty } from 'neba';

import { locale, t } from '../../i18n/runtime.js';

import { ListIcon, ScanIcon } from './icons.jsx';

// What the list area shows when there is nothing to list. Before the first
// scan it doubles as a short guide, so a first-time user knows where to start.
export function EmptyState({ reason, busy, listTitle, onScan }) {
  if (reason === 'filtered') {
    return <Empty className="empty-state" icon={<ListIcon />} title={t('empty.filtered')} locale={locale} />;
  }

  if (reason === 'empty') {
    return <Empty className="empty-state" icon={<ListIcon />} title={t('empty.empty')} locale={locale} />;
  }

  return (
    <Empty
      className="empty-state"
      icon={<ScanIcon />}
      title={t('empty.title', { title: listTitle })}
      locale={locale}
      action={(
        <Button size="lg" variant="solid" color="primary" startIcon={<ScanIcon />} onClick={onScan} disabled={busy}>
          {t('common.scan')}
        </Button>
      )}
    >
      <p className="empty-lead">{t('empty.lead')}</p>
      <ol className="empty-steps">
        <li>{t('empty.step-scan')}</li>
        <li>{t('empty.step-pick')}</li>
        <li>{t('empty.step-remove')}</li>
      </ol>
    </Empty>
  );
}
