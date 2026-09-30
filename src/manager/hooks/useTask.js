import { useCallback, useRef, useState } from 'react';

import { t } from '../../i18n/runtime.js';

// One long-running job at a time: scanning, removing, exporting, or looking
// up categories. `task` is null when nothing runs.
export const useTask = () => {
  const [task, setTask] = useState(null);
  const controllerRef = useRef(null);

  const start = useCallback(({ kind, label, cancellable = true }) => {
    const controller = new AbortController();

    controllerRef.current = controller;
    setTask({ kind, label, value: null, max: 1, cancellable, cancelling: false });

    return controller;
  }, []);

  const update = useCallback((patch) => {
    setTask((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const end = useCallback(() => {
    controllerRef.current = null;
    setTask(null);
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setTask((current) => (current ? { ...current, cancelling: true, label: t('status.cancelling') } : current));
  }, []);

  return { task, start, update, end, cancel };
};
