// Entry point of the content script: answers pings from the manager and runs
// one job at a time over a port. Closing the manager closes the port, which
// cancels the job, so nothing keeps running without someone watching.
(() => {
  const ns = (globalThis.ytEasy ??= {});
  const { collector, remover, overlay, page, util } = ns;

  const JOB_PORT_NAME = 'yt-easy-job';
  const MAX_TARGETS = 5000;
  const MAX_TITLE_LENGTH = 300;
  const MAX_LABELS = 5;
  const MAX_LABEL_LENGTH = 100;
  const DELAY_MIN_LIMIT = 1000;
  const DELAY_MAX_LIMIT = 30000;

  let activeJob = null;

  const isFromThisExtension = (sender) => sender?.id === chrome.runtime.id;

  const clampDelay = (value, fallback) => {
    const number = Number.isFinite(value) ? value : fallback;

    return Math.min(Math.max(number, DELAY_MIN_LIMIT), DELAY_MAX_LIMIT);
  };

  // The manager is ours, but the command still crosses a boundary, so it is
  // checked before it drives clicks on the page.
  const readRemoveCommand = (message) => {
    const targets = (Array.isArray(message.targets) ? message.targets : [])
      .filter((target) => util.isVideoId(target?.videoId))
      .slice(0, MAX_TARGETS)
      .map((target) => ({ videoId: target.videoId, title: String(target.title ?? '').slice(0, MAX_TITLE_LENGTH) }));
    const options = message.options ?? {};
    const delayMin = clampDelay(options.delayMin, 1000);
    const delayMax = Math.max(delayMin, clampDelay(options.delayMax, 2000));
    const removeLabels = (Array.isArray(options.removeLabels) ? options.removeLabels : [])
      .filter((label) => typeof label === 'string' && label.length <= MAX_LABEL_LENGTH)
      .slice(0, MAX_LABELS);

    return { targets, options: { delayMin, delayMax, removeLabels, dryRun: options.dryRun === true } };
  };

  const describeOutcome = ({ results, cancelled, stopReason, dryRun }) => {
    const succeeded = results.filter((result) => result.ok).length;
    const failed = results.length - succeeded;

    if (cancelled) {
      return `취소했습니다. 성공 ${succeeded} · 실패 ${failed}`;
    }

    if (stopReason) {
      return stopReason;
    }

    return dryRun
      ? `확인을 마쳤습니다. 정상 ${succeeded} · 실패 ${failed}`
      : `삭제를 마쳤습니다. 성공 ${succeeded} · 실패 ${failed}`;
  };

  const runCollect = async ({ message, post, signal }) => {
    try {
      const result = await collector.collect({
        mode: message.mode === 'dom' ? 'dom' : 'auto',
        signal,
        onProgress: (progress) => post({ type: 'progress', ...progress }),
      });

      post({ type: 'done', result });
    } catch (error) {
      if (util.isAbortError(error)) {
        post({ type: 'cancelled' });
        return;
      }

      if (error.name !== 'CollectError') {
        console.error('yt-easy: collection failed.', error);
      }

      post({
        type: 'error',
        code: error.code ?? 'failed',
        message: error.name === 'CollectError' ? error.message : '목록을 수집하는 중 오류가 발생했습니다.',
      });
    }
  };

  const runRemove = async ({ message, post, controller }) => {
    const { targets, options } = readRemoveCommand(message);

    if (!page.isWatchLaterPage()) {
      post({ type: 'error', message: '이 탭이 나중에 볼 동영상 페이지가 아닙니다.' });
      return;
    }

    if (targets.length === 0) {
      post({ type: 'error', message: '삭제할 영상이 없습니다.' });
      return;
    }

    let succeeded = 0;
    let failed = 0;

    overlay.show({
      title: options.dryRun ? 'yt-easy · 삭제 메뉴 확인 (드라이런)' : 'yt-easy · 나중에 볼 동영상에서 삭제 중',
      onCancel: () => controller.abort(),
    });

    try {
      const outcome = await remover.removeAll({
        targets,
        options,
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.result) {
            if (progress.result.ok) {
              succeeded += 1;
            } else {
              failed += 1;
            }
          }

          overlay.update({
            done: progress.done,
            total: progress.total,
            succeeded,
            failed,
            paused: progress.paused,
            currentTitle: progress.current?.title,
          });
          post({ type: 'progress', ...progress });
        },
      });

      overlay.finish(describeOutcome(outcome));
      post({ type: 'done', result: outcome });
    } catch (error) {
      console.error('yt-easy: removal failed.', error);
      overlay.finish('오류로 중단했습니다.');
      post({ type: 'error', message: '삭제 중 오류가 발생해 중단했습니다. 목록을 다시 수집해 결과를 확인해 주세요.' });
    }
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isFromThisExtension(sender) || message?.type !== 'ping') {
      return;
    }

    sendResponse({
      ready: true,
      isWatchLater: page.isWatchLaterPage(),
      visible: page.isVisible(),
      busy: activeJob !== null,
    });
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== JOB_PORT_NAME || !isFromThisExtension(port.sender)) {
      return;
    }

    const controller = new AbortController();
    const post = (message) => {
      try {
        port.postMessage(message);
      } catch {
        // The manager went away; the job is already being cancelled.
      }
    };

    port.onDisconnect.addListener(() => controller.abort());
    port.onMessage.addListener((message) => {
      if (message?.type === 'cancel') {
        controller.abort();
        return;
      }

      if (activeJob) {
        post({ type: 'error', message: '이미 다른 작업이 진행 중입니다.' });
        return;
      }

      const context = { message, post, controller, signal: controller.signal };

      if (message?.type === 'collect') {
        activeJob = runCollect(context);
      } else if (message?.type === 'remove') {
        activeJob = runRemove(context);
      } else {
        return;
      }

      activeJob.finally(() => {
        activeJob = null;
      });
    });
  });
})();
