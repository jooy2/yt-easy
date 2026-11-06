import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadContentScripts, plain } from './helpers/content-scripts.mjs';

const NO_DELAYS = [0, 0];

// A `run` that answers each try with the next of `answers`: a result, or an
// error to throw.
const scripted = (answers) => {
  const calls = { run: 0, reset: 0, retries: [] };
  const run = async () => {
    const answer = answers[calls.run];

    calls.run += 1;

    if (answer instanceof Error) {
      throw answer;
    }

    return answer;
  };

  return { calls, run, reset: async () => { calls.reset += 1; }, onRetry: (retry) => calls.retries.push(retry) };
};

const failure = (code) => ({ ok: false, code, reason: code });

describe('remover.retryRemoval', () => {
  const { remover } = loadContentScripts();
  const quiet = { warn: () => {} };

  const retry = (script, options = {}) => remover.retryRemoval({
    run: script.run,
    reset: script.reset,
    onRetry: script.onRetry,
    isGone: () => false,
    delays: NO_DELAYS,
    ...options,
  });

  it('returns a success at once', async () => {
    const script = scripted([{ ok: true }]);

    assert.deepEqual(plain(await retry(script)), { ok: true });
    assert.equal(script.calls.run, 1);
    assert.equal(script.calls.reset, 0);
  });

  it('tries again after a failure a retry can fix, closing what the try left open first', async () => {
    const script = scripted([failure('no-remove-entry'), failure('no-menu-button'), { ok: true }]);

    assert.deepEqual(plain(await retry(script)), { ok: true });
    assert.equal(script.calls.run, 3);
    assert.equal(script.calls.reset, 2);
    assert.deepEqual(plain(script.calls.retries), [{ attempt: 2, max: 3 }, { attempt: 3, max: 3 }]);
  });

  it('gives up with the last failure once the retries run out', async () => {
    const script = scripted([failure('no-remove-entry'), failure('no-remove-entry'), failure('list-stalled')]);

    assert.equal((await retry(script)).code, 'list-stalled');
    assert.equal(script.calls.run, 3);
  });

  it('does not retry a video that is not in the list', async () => {
    const script = scripted([failure('not-found')]);

    assert.equal((await retry(script)).code, 'not-found');
    assert.equal(script.calls.run, 1);
  });

  it('counts an unconfirmed removal as done when the row is gone by the retry', async () => {
    const script = scripted([failure('unconfirmed')]);

    assert.deepEqual(plain(await retry(script, { isGone: () => true })), { ok: true });
    assert.equal(script.calls.run, 1);
  });

  it('turns an unexpected error into a failed try and goes on', async (t) => {
    t.mock.method(console, 'warn', quiet.warn);

    const script = scripted([new TypeError('the page changed'), { ok: true }]);

    assert.deepEqual(plain(await retry(script)), { ok: true });

    const repeated = scripted([new TypeError('a'), new TypeError('b'), new TypeError('c')]);

    assert.equal((await retry(repeated)).code, 'error');
    assert.equal(repeated.calls.run, 3);
  });

  it('lets a cancel through without retrying', async () => {
    const script = scripted([new DOMException('The job was cancelled.', 'AbortError')]);

    await assert.rejects(retry(script), { name: 'AbortError' });
    assert.equal(script.calls.run, 1);
  });
});
