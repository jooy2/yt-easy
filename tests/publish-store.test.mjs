import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, it } from 'node:test';

import { buildAssertion, compareVersions, readServiceAccount, readStoreVersion } from '../scripts/publish-store.mjs';

// A key made for the test; it belongs to no account.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' });

const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

describe('readServiceAccount', () => {
  it('reads the email, the key, and the key ID', () => {
    const text = JSON.stringify({ type: 'service_account', client_email: 'robot@example.iam.gserviceaccount.com', private_key: PRIVATE_PEM, private_key_id: 'key-1' });

    assert.deepEqual(readServiceAccount(text), { email: 'robot@example.iam.gserviceaccount.com', privateKey: PRIVATE_PEM, keyId: 'key-1' });
  });

  it('rejects text that is not a service account key without repeating it', () => {
    assert.throws(() => readServiceAccount('not json secret-value'), (error) => !error.message.includes('secret-value'));
    assert.throws(() => readServiceAccount(JSON.stringify({ type: 'authorized_user', client_id: 'x' })), /not a service account key/);
  });
});

describe('buildAssertion', () => {
  it('signs a token request for the Chrome Web Store scope that lasts an hour', () => {
    const assertion = buildAssertion({ email: 'robot@example.iam.gserviceaccount.com', privateKey: PRIVATE_PEM, keyId: 'key-1' }, 1_790_000_000_000);
    const [header, claims, signature] = assertion.split('.');

    assert.deepEqual(decode(header), { alg: 'RS256', typ: 'JWT', kid: 'key-1' });
    assert.deepEqual(decode(claims), {
      iss: 'robot@example.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/chromewebstore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_790_000_000,
      exp: 1_790_003_600,
    });
    assert.equal(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url')), true);
  });
});

describe('compareVersions and readStoreVersion', () => {
  it('compares dotted versions part by part', () => {
    assert.ok(compareVersions('1.0.10', '1.0.9') > 0);
    assert.ok(compareVersions('0.9', '1.0.0') < 0);
    assert.equal(compareVersions('1.0', '1.0.0'), 0);
  });

  it('takes the highest version in review or published', () => {
    const status = {
      publishedItemRevisionStatus: { state: 'PUBLISHED', distributionChannels: [{ deployPercentage: 100, crxVersion: '0.1.0' }] },
      submittedItemRevisionStatus: { state: 'PENDING_REVIEW', distributionChannels: [{ crxVersion: '1.0.0' }] },
    };

    assert.equal(readStoreVersion(status), '1.0.0');
    assert.equal(readStoreVersion({ publishedItemRevisionStatus: status.publishedItemRevisionStatus }), '0.1.0');
    assert.equal(readStoreVersion({}), null);
  });
});
