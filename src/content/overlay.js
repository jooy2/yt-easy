// A small card on the Watch later page that shows removal progress and lets
// the job be cancelled from the page itself. It lives in a shadow root so
// YouTube's styles and ours cannot affect each other.
(() => {
  const ns = (globalThis.ytEasy ??= {});

  const HIDE_DELAY = 6000;

  const STYLE = `
    :host { all: initial; }
    .card {
      position: fixed;
      left: 16px;
      bottom: 16px;
      z-index: 2147483647;
      box-sizing: border-box;
      width: min(340px, calc(100vw - 32px));
      padding: 14px 16px;
      border-radius: 12px;
      background: #1f2430;
      color: #f4f6fb;
      font: 13px/1.5 system-ui, -apple-system, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
      box-shadow: 0 8px 28px rgb(0 0 0 / 35%);
    }
    .heading { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
    .status, .current, .note { margin: 0; }
    .current { margin-top: 2px; color: #c5cbe0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .note { margin-top: 8px; color: #aab2c8; font-size: 12px; }
    progress { display: block; width: 100%; height: 6px; margin: 8px 0 0; accent-color: #7ea2ff; }
    .actions { display: flex; justify-content: flex-end; margin-top: 10px; }
    button {
      padding: 6px 14px;
      border: 1px solid #5b6480;
      border-radius: 8px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    button:hover { background: #2c3344; }
    button:focus-visible { outline: 2px solid #7ea2ff; outline-offset: 2px; }
    button[hidden] { display: none; }
  `;

  let host = null;
  let parts = null;
  let hideTimer = 0;

  const build = () => {
    host = document.createElement('div');
    host.id = 'yt-easy-overlay';

    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const card = document.createElement('section');

    style.textContent = STYLE;
    card.className = 'card';
    card.setAttribute('aria-label', 'yt-easy 작업 진행 상황');

    const heading = document.createElement('p');
    const status = document.createElement('p');
    const current = document.createElement('p');
    const progress = document.createElement('progress');
    const note = document.createElement('p');
    const actions = document.createElement('div');
    const cancel = document.createElement('button');

    heading.className = 'heading';
    status.className = 'status';
    status.setAttribute('role', 'status');
    current.className = 'current';
    note.className = 'note';
    note.textContent = '진행 중에는 이 탭을 화면에 띄워 두고, 페이지를 조작하지 마세요.';
    actions.className = 'actions';
    cancel.type = 'button';
    cancel.textContent = '취소';

    actions.append(cancel);
    card.append(heading, status, current, progress, note, actions);
    root.append(style, card);

    parts = { heading, status, current, progress, note, cancel };
  };

  const show = ({ title, onCancel }) => {
    clearTimeout(hideTimer);

    if (!host) {
      build();
    }

    parts.heading.textContent = title;
    parts.status.textContent = '준비 중…';
    parts.current.textContent = '';
    parts.progress.removeAttribute('value');
    parts.note.hidden = false;
    parts.cancel.hidden = false;
    parts.cancel.onclick = onCancel;

    if (!host.isConnected) {
      document.documentElement.append(host);
    }
  };

  const update = ({ done, total, succeeded, failed, currentTitle, paused }) => {
    if (!parts) {
      return;
    }

    parts.progress.max = Math.max(total, 1);
    parts.progress.value = done;
    parts.status.textContent = paused
      ? `일시 정지: 이 탭이 화면에 보이면 이어서 진행합니다 (${done}/${total})`
      : `${done}/${total} 처리 · 성공 ${succeeded} · 실패 ${failed}`;

    if (currentTitle !== undefined) {
      parts.current.textContent = currentTitle;
    }
  };

  const finish = (message) => {
    if (!parts) {
      return;
    }

    parts.status.textContent = message;
    parts.current.textContent = '';
    parts.note.hidden = true;
    parts.cancel.hidden = true;
    hideTimer = setTimeout(hide, HIDE_DELAY);
  };

  const hide = () => {
    clearTimeout(hideTimer);
    host?.remove();
  };

  ns.overlay = { show, update, finish, hide };
})();
