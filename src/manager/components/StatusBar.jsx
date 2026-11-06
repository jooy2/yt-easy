import { Alert, Button, ProgressLinear } from 'neba';

import { locale, t } from '../../i18n/runtime.js';

// The summary line, the running task with its progress, and the last error.
// While a filter narrows the list, the line offers to clear it, since the
// filters are remembered and may have been set long ago.
export function StatusBar({ summary, filtersActive, onClearFilters, task, onCancel, message, onDismissMessage }) {
  return (
    <div className="status-bar">
      {summary && (
        <div className="summary-line">
          <p className="summary" title={summary.detail}>{summary.text}</p>
          {filtersActive && (
            <Button size="xs" variant="outline" color="primary" onClick={onClearFilters}>{t('status.clear-filters')}</Button>
          )}
        </div>
      )}
      {task && (
        <div className="task-box">
          <div className="task-line">
            <p className="task-label" role="status">{task.label}</p>
            {task.cancellable && (
              <Button size="xs" variant="outline" onClick={onCancel} disabled={task.cancelling}>
                {t('common.cancel')}
              </Button>
            )}
          </div>
          <ProgressLinear value={task.value} max={task.max} aria-label={task.label} />
        </div>
      )}
      {message && (
        <Alert color="danger" onClose={onDismissMessage} locale={locale}>
          {message}
        </Alert>
      )}
    </div>
  );
}
