// Removes videos from Watch later by doing what a person would do on the
// page: open the row's menu, then choose "Remove from Watch later".
(() => {
  const ns = (globalThis.ytEasy ??= {});
  const { SELECTORS, REMOVE_MENU_LABELS, util, page } = ns;

  const MENU_OPEN_TIMEOUT = 4000;
  const MENU_CLOSE_TIMEOUT = 1500;
  const REMOVAL_TIMEOUT = 8000;
  const MAX_CONSECUTIVE_FAILURES = 3;

  const FAILURE_REASONS = {
    'not-found': '목록에서 찾지 못했습니다.',
    'list-stalled': '목록을 더 불러오지 못했습니다.',
    'no-menu-button': '메뉴 버튼을 찾지 못했습니다.',
    'no-remove-entry': '메뉴에서 삭제 항목을 찾지 못했습니다.',
    unconfirmed: '삭제가 확인되지 않았습니다.',
    error: '예상하지 못한 오류가 발생했습니다.',
  };

  // Stops the whole job: the row count dropped while the target stayed, so a
  // click may have landed on another video.
  class WrongRowError extends Error {}

  const fail = (code) => ({ ok: false, code, reason: FAILURE_REASONS[code] });

  const normalizeLabel = (text) => String(text).normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

  // A closing menu gets aria-hidden at once but stays on screen until its
  // animation ends, so "visible" and "open" are checked separately.
  const isMenuVisible = (popup) => popup.style.display !== 'none' && popup.getClientRects().length > 0;

  const isMenuOpen = (popup) => isMenuVisible(popup) && popup.getAttribute('aria-hidden') !== 'true';

  const getMenus = () => [...document.querySelectorAll(SELECTORS.menuPopup)];

  const getOpenMenus = () => getMenus().filter(isMenuOpen);

  const findRemoveEntry = (labels) => {
    for (const popup of getOpenMenus()) {
      for (const entry of popup.querySelectorAll(SELECTORS.menuEntry)) {
        if (labels.includes(normalizeLabel(util.textOf(entry)))) {
          return entry;
        }
      }
    }

    return null;
  };

  // Closes any open menu with Escape and waits until it has left the screen,
  // so the next menu never opens on top of the previous one. Runs during
  // cleanup too, so it takes no abort signal.
  const closeMenu = async () => {
    if (getOpenMenus().length > 0) {
      const target = document.activeElement ?? document.body;

      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        composed: true,
      }));
    }

    await util.waitFor(() => !getMenus().some(isMenuVisible), { timeout: MENU_CLOSE_TIMEOUT });
  };

  // Finds the row, scrolling further down the list when it is not loaded yet.
  const locate = async ({ videoId, signal, onPause }) => {
    let item = page.findItemElement(videoId);

    while (!item) {
      const state = await page.loadMore({ signal, onPause });

      if (state !== 'loaded') {
        return { item: null, code: state === 'stalled' ? 'list-stalled' : 'not-found' };
      }

      item = page.findItemElement(videoId);
    }

    return { item };
  };

  const removeOne = async ({ videoId, labels, dryRun, signal, onPause }) => {
    await page.waitUntilVisible({ signal, onPause });

    const { item, code } = await locate({ videoId, signal, onPause });

    if (!item) {
      return fail(code);
    }

    await closeMenu();
    item.scrollIntoView({ block: 'center' });
    await util.sleep(util.randomBetween(300, 600), signal);

    const button = item.querySelector(SELECTORS.itemMenuButton);

    if (!button) {
      return fail('no-menu-button');
    }

    button.click();

    const entry = await util.waitFor(() => findRemoveEntry(labels), {
      timeout: MENU_OPEN_TIMEOUT,
      signal,
    });

    if (!entry) {
      await closeMenu();
      return fail('no-remove-entry');
    }

    // Let the menu settle, and leave a pause a person would leave.
    await util.sleep(util.randomBetween(250, 500), signal);

    if (dryRun) {
      await closeMenu();
      return { ok: true };
    }

    const rowsBefore = page.getItemElements().length;

    (entry.querySelector(SELECTORS.menuEntryTarget) ?? entry).click();

    const removed = await util.waitFor(() => !page.findItemElement(videoId), {
      timeout: REMOVAL_TIMEOUT,
      interval: 200,
      signal,
    });

    await closeMenu();

    if (removed) {
      return { ok: true };
    }

    if (page.getItemElements().length < rowsBefore) {
      throw new WrongRowError('대상이 아닌 영상이 삭제됐을 수 있어 중단했습니다. 목록을 다시 스캔해 확인해 주세요.');
    }

    return fail('unconfirmed');
  };

  // Removes `targets` one by one, in the given order, with a random pause
  // between them. Stops on cancel, when the tab leaves Watch later, and after
  // several failures in a row, since that usually means the page changed.
  const removeAll = async ({ targets, options, signal, onProgress }) => {
    const labels = [...options.removeLabels, ...REMOVE_MENU_LABELS].map(normalizeLabel).filter(Boolean);
    const results = [];
    const total = targets.length;
    let consecutiveFailures = 0;
    let stopReason = null;
    let cancelled = false;

    const onPause = () => onProgress?.({ done: results.length, total, paused: true });

    try {
      for (const [index, target] of targets.entries()) {
        if (!page.isWatchLaterPage()) {
          stopReason = '나중에 볼 동영상 페이지를 벗어나 중단했습니다.';
          break;
        }

        onProgress?.({ done: index, total, current: target });

        let result = null;

        try {
          result = await removeOne({ videoId: target.videoId, labels, dryRun: options.dryRun, signal, onPause });
        } catch (error) {
          if (!(error instanceof WrongRowError)) {
            throw error;
          }

          stopReason = error.message;
          result = fail('unconfirmed');
        }

        results.push({ videoId: target.videoId, ...result });
        onProgress?.({ done: index + 1, total, result: results.at(-1) });

        if (stopReason) {
          break;
        }

        // A video that is simply gone does not point at a broken page.
        consecutiveFailures = result.ok || result.code === 'not-found' ? 0 : consecutiveFailures + 1;

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          stopReason = `연속 ${MAX_CONSECUTIVE_FAILURES}번 실패해 중단했습니다. YouTube 화면 구조가 바뀌었을 수 있습니다.`;
          break;
        }

        if (index < total - 1) {
          await util.sleep(util.randomBetween(options.delayMin, options.delayMax), signal);
        }
      }
    } catch (error) {
      if (!util.isAbortError(error)) {
        throw error;
      }

      cancelled = true;
    } finally {
      await closeMenu();
    }

    return { results, cancelled, stopReason, dryRun: options.dryRun };
  };

  ns.remover = { removeAll };
})();
