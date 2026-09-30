import { Alert, Button, ProgressLinear } from 'neba';

import { locale, t } from '../../i18n/runtime.js';

// The summary line, the running task with its progress, and the last error.
export function StatusBar({ summary, task, onCancel, message, onDismissMessage }) {
  return (
    <div className="status-bar">
      {summary && <p className="summary">{summary}</p>}
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
