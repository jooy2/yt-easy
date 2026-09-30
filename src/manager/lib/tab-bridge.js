// Finds or opens the tab of a playlist (Watch later is the playlist `WL`)
// and runs jobs in its content script.
import { toPlaylistUrl } from './sources.js';

const JOB_PORT_NAME = 'yt-easy-job';
const TAB_LOAD_TIMEOUT = 30000;
const PING_INTERVAL = 500;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const isListUrl = (value, listId) => {
  try {
    const url = new URL(value);

    return url.origin === 'https://www.youtube.com' && url.pathname === '/playlist' && url.searchParams.get('list') === listId;
  } catch {
    return false;
  }
};

// Prefers a tab of the list in this window, and the active one among those.
const findListTab = async (listId) => {
  const [current, tabs] = await Promise.all([
    chrome.windows.getCurrent(),
    chrome.tabs.query({ url: 'https://www.youtube.com/playlist*' }),
  ]);
  const score = (tab) => (tab.windowId === current.id ? 2 : 0) + (tab.active ? 1 : 0);

  return tabs.filter((tab) => isListUrl(tab.url, listId)).sort((a, b) => score(b) - score(a))[0] ?? null;
};

const waitForTabComplete = (tabId) => new Promise((resolve, reject) => {
  const cleanup = () => {
    clearTimeout(timer);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  };
  const onUpdated = (id, info) => {
    if (id === tabId && info.status === 'complete') {
      cleanup();
      resolve();
    }
  };
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error('YouTube 탭이 로드되지 않았습니다.'));
  }, TAB_LOAD_TIMEOUT);

  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.get(tabId).then((tab) => {
    if (tab.status === 'complete') {
      cleanup();
      resolve();
    }
  }, (error) => {
    cleanup();
    reject(error);
  });
});

const ping = async (tabId) => {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'ping' });
  } catch {
    return null;
  }
};

const waitForContentScript = async (tabId, attempts) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await ping(tabId);

    if (status?.ready) {
      return status;
    }

    await sleep(PING_INTERVAL);
  }

  return null;
};

// Returns a tab of the list whose content script answers. With `activate`,
// the tab is brought to the front, which removal and the scrolling fallback
// need: Chrome pauses rendering in background tabs.
export const prepareListTab = async ({ listId, activate }) => {
  let tab = await findListTab(listId);

  if (!tab) {
    const current = await chrome.windows.getCurrent();

    tab = await chrome.tabs.create({ url: toPlaylistUrl(listId), active: activate, windowId: current.id });
  }

  if (activate) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  }

  await waitForTabComplete(tab.id);

  let status = await waitForContentScript(tab.id, 6);

  if (!status) {
    // A tab opened before the extension was installed or reloaded has no
    // content script until it loads again.
    await chrome.tabs.reload(tab.id);
    await waitForTabComplete(tab.id);
    status = await waitForContentScript(tab.id, 10);
  }

  if (!status) {
    throw new Error('YouTube 탭에 연결하지 못했습니다. 재생목록 탭을 새로고침한 뒤 다시 시도해 주세요.');
  }

  if (status.busy) {
    throw new Error('YouTube 탭에서 이미 다른 작업이 진행 중입니다.');
  }

  return { tab, status };
};

// Sends one command over a port and resolves with its result. Aborting
// `signal` asks the content script to stop; it answers with what it did.
export const runJob = ({ tabId, command, signal, onProgress }) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('The job was cancelled.', 'AbortError'));
    return;
  }

  const port = chrome.tabs.connect(tabId, { name: JOB_PORT_NAME });
  let settled = false;

  const onAbort = () => {
    try {
      port.postMessage({ type: 'cancel' });
    } catch {
      // Already disconnected.
    }
  };

  const settle = (callback, value) => {
    if (settled) {
      return;
    }

    settled = true;
    signal?.removeEventListener('abort', onAbort);
    port.disconnect();
    callback(value);
  };

  port.onMessage.addListener((message) => {
    if (message?.type === 'progress') {
      onProgress?.(message);
    } else if (message?.type === 'done') {
      settle(resolve, message.result);
    } else if (message?.type === 'cancelled') {
      settle(reject, new DOMException('The job was cancelled.', 'AbortError'));
    } else if (message?.type === 'error') {
      settle(reject, Object.assign(new Error(message.message), { code: message.code }));
    }
  });

  port.onDisconnect.addListener(() => {
    if (!settled) {
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('YouTube 탭과의 연결이 끊어졌습니다. 탭이 닫혔거나 새로고침됐을 수 있습니다.'));
    }
  });

  signal?.addEventListener('abort', onAbort, { once: true });
  port.postMessage(command);
});
