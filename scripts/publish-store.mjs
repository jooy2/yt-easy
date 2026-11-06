// Uploads a built zip to the Chrome Web Store and submits it for review,
// through the Chrome Web Store API v2 with a service account. The release
// workflow runs it after the zip is attached to the GitHub release.
//
//   node scripts/publish-store.mjs yt-easy-1.0.0.zip
//
// It reads two values from the environment: `CWS_SERVICE_ACCOUNT_KEY`, the
// service account's JSON key, and `CWS_PUBLISHER_ID`, from the Developer
// Dashboard. Without them it says so and exits without an error, so a tag
// still releases on GitHub before the store is set up, and in a fork.
//
// A version the store already holds, in review or published, is skipped, so
// running the workflow again for the same tag does not fail. Once review
// passes, the store publishes the version on its own.
import { sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const ITEM_ID = 'edoljgbfefckidklbddneoekcakdighb';
const API = 'https://chromewebstore.googleapis.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const TOKEN_LIFETIME = 3600;
const STATUS_POLL_INTERVAL = 5000;
const STATUS_POLL_LIMIT = 24;
// The usage guide writes the state of a running upload one way and the
// reference the other, so both are read.
const UPLOAD_RUNNING = new Set(['IN_PROGRESS', 'UPLOAD_IN_PROGRESS']);

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const base64url = (value) => Buffer.from(value).toString('base64url');

// Reads the fields the token request needs from the JSON key. The message of
// a failure never repeats the key.
export const readServiceAccount = (text) => {
  let key = null;

  try {
    key = JSON.parse(text);
  } catch {
    throw new Error('CWS_SERVICE_ACCOUNT_KEY is not valid JSON. Paste the whole JSON key file of the service account.');
  }

  if (key?.type !== 'service_account' || typeof key.client_email !== 'string' || typeof key.private_key !== 'string') {
    throw new Error('CWS_SERVICE_ACCOUNT_KEY is not a service account key. It needs "type", "client_email", and "private_key".');
  }

  return { email: key.client_email, privateKey: key.private_key, keyId: typeof key.private_key_id === 'string' ? key.private_key_id : null };
};

// The signed JWT that a service account trades for an access token.
export const buildAssertion = ({ email, privateKey, keyId }, now = Date.now()) => {
  const issuedAt = Math.floor(now / 1000);
  const header = { alg: 'RS256', typ: 'JWT', ...(keyId ? { kid: keyId } : {}) };
  const claims = { iss: email, scope: SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + TOKEN_LIFETIME };
  const input = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');

  return `${input}.${signature}`;
};

// Compares dotted versions part by part: "1.0.10" comes after "1.0.9", and
// "1.0" equals "1.0.0". Returns a negative number, zero, or a positive one.
export const compareVersions = (a, b) => {
  const left = String(a).split('.').map(Number);
  const right = String(b).split('.').map(Number);

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
};

// The highest version the store holds, in review or published, or null.
export const readStoreVersion = (status) => {
  const versions = [status?.submittedItemRevisionStatus, status?.publishedItemRevisionStatus]
    .flatMap((revision) => revision?.distributionChannels ?? [])
    .map((channel) => channel.crxVersion)
    .filter((version) => typeof version === 'string' && version !== '');

  return versions.reduce((highest, version) => (highest === null || compareVersions(version, highest) > 0 ? version : highest), null);
};

const request = async (url, { method = 'GET', token, headers = {}, body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body,
  });
  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = data?.error_description ?? data?.error?.message ?? text.slice(0, 300);

    throw new Error(`${method} ${new URL(url).pathname} failed with HTTP ${response.status}: ${detail}`);
  }

  return data;
};

const getAccessToken = async (account) => {
  const data = await request(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: buildAssertion(account) }),
  });

  if (typeof data?.access_token !== 'string') {
    throw new Error('The token response has no access token.');
  }

  return data.access_token;
};

// Waits for an upload the store is still handling. Resolves to its final
// state, or to the running state when it takes too long.
const waitForUpload = async ({ name, token }) => {
  for (let attempt = 0; attempt < STATUS_POLL_LIMIT; attempt += 1) {
    await sleep(STATUS_POLL_INTERVAL);

    const status = await request(`${API}/v2/${name}:fetchStatus`, { token });

    if (!UPLOAD_RUNNING.has(status?.lastAsyncUploadState)) {
      return status?.lastAsyncUploadState;
    }
  }

  return 'IN_PROGRESS';
};

const main = async (zipFile) => {
  const keyText = process.env.CWS_SERVICE_ACCOUNT_KEY ?? '';
  const publisherId = process.env.CWS_PUBLISHER_ID ?? '';

  if (!keyText || !publisherId) {
    console.log('::notice::The Chrome Web Store submission was skipped: CWS_SERVICE_ACCOUNT_KEY or CWS_PUBLISHER_ID is not set.');
    return;
  }

  if (!zipFile) {
    throw new Error('Pass the zip to upload, such as yt-easy-1.0.0.zip.');
  }

  const { version } = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const name = `publishers/${encodeURIComponent(publisherId)}/items/${ITEM_ID}`;
  const token = await getAccessToken(readServiceAccount(keyText));
  const storeVersion = readStoreVersion(await request(`${API}/v2/${name}:fetchStatus`, { token }));

  if (storeVersion && compareVersions(storeVersion, version) >= 0) {
    console.log(`::notice::The Chrome Web Store already holds version ${storeVersion}, so ${version} was not submitted.`);
    return;
  }

  const upload = await request(`${API}/upload/v2/${name}:upload`, { method: 'POST', token, body: readFileSync(zipFile) });
  let uploadState = upload?.uploadState;

  if (UPLOAD_RUNNING.has(uploadState)) {
    uploadState = await waitForUpload({ name, token });
  }

  if (uploadState !== 'SUCCEEDED') {
    throw new Error(`The upload of ${version} ended as ${uploadState ?? 'unknown'}. Check the item in the Developer Dashboard.`);
  }

  console.log(`Uploaded ${version} to the Chrome Web Store.`);

  const published = await request(`${API}/v2/${name}:publish`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' }),
  });

  for (const warning of published?.warningInfo?.warnings ?? []) {
    console.log(`::warning::${warning.reason}: ${warning.description}`);
  }

  console.log(`Submitted ${version} for review. Item state: ${published?.state ?? 'unknown'}.`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
