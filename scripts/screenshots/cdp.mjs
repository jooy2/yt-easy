// Starts headless Chrome with a new, empty profile and talks to it over the
// DevTools protocol pipe. Branded Chrome ignores --load-extension, so the
// extension is loaded with `Extensions.loadUnpacked` instead.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_CHROME = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
};

export const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

export const launchChrome = ({ lang }) => {
  const executable = process.env.CHROME_PATH ?? DEFAULT_CHROME[process.platform];
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'yt-easy-screenshots-'));
  const child = spawn(executable, [
    '--headless=new',
    '--remote-debugging-pipe',
    '--enable-unsafe-extension-debugging',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--hide-scrollbars',
    `--lang=${lang}`,
    `--accept-lang=${lang}`,
    // On macOS, Chrome takes its UI language from the system settings and
    // ignores --lang; a Cocoa default on the command line overrides them.
    ...(process.platform === 'darwin' ? ['-AppleLanguages', `(${lang})`] : []),
  ], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

  const input = child.stdio[3];
  const output = child.stdio[4];
  const pending = new Map();
  let nextId = 1;
  let buffer = '';

  // Messages on the pipe end with a NUL character.
  output.on('data', (chunk) => {
    buffer += chunk.toString('utf8');

    let end = buffer.indexOf('\0');

    while (end !== -1) {
      const message = JSON.parse(buffer.slice(0, end));
      const waiting = pending.get(message.id);

      buffer = buffer.slice(end + 1);
      end = buffer.indexOf('\0');

      if (waiting) {
        pending.delete(message.id);

        if (message.error) {
          waiting.reject(new Error(`${message.error.message} ${message.error.data ?? ''}`.trim()));
        } else {
          waiting.resolve(message.result);
        }
      }
    }
  });

  const send = (method, params = {}, sessionId = undefined) => new Promise((resolve, reject) => {
    const id = nextId;

    nextId += 1;
    pending.set(id, { resolve, reject });
    input.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
  });

  const close = async () => {
    await send('Browser.close').catch(() => {});
    child.kill();
    await sleep(500);
    rmSync(userDataDir, { recursive: true, force: true });
  };

  return { send, close };
};
