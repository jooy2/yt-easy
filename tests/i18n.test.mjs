import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTranslator, formatMessage, listArguments, resolveLocale } from '../src/i18n/message-format.js';
import { BASE_LOCALE, MESSAGES, locale } from '../src/i18n/runtime.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx']);
// A manifest description longer than this is cut off by Chrome.
const MANIFEST_DESCRIPTION_MAX = 132;

const format = (text, values, tag = 'en') => formatMessage({ text, values, locale: tag });

const listKeys = (messages) => Object.entries(messages).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}.${name}`));

const readMessage = (messages, key) => {
  const [group, name] = key.split('.');

  return messages[group][name];
};

const listSourceFiles = (folder) => readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(folder, entry.name);

  if (entry.isDirectory()) {
    return listSourceFiles(full);
  }

  return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
});

// Every quoted "group.key" in the source whose group is a message group.
const findUsedKeys = () => {
  const groups = new Set(Object.keys(MESSAGES[BASE_LOCALE]));
  const used = new Set();

  for (const file of listSourceFiles(path.join(ROOT, 'src'))) {
    for (const [, group, name] of readFileSync(file, 'utf8').matchAll(/'([a-z]+(?:-[a-z]+)*)\.([a-z0-9]+(?:-[a-z0-9]+)*)'/g)) {
      if (groups.has(group)) {
        used.add(`${group}.${name}`);
      }
    }
  }

  return used;
};

describe('formatMessage', () => {
  it('inserts values, and formats numbers for the locale', () => {
    assert.deepEqual(format('Removed {title}.', { title: 'Travel' }), ['Removed Travel.']);
    assert.deepEqual(format('{count} selected', { count: 12345 }), ['12,345 selected']);
  });

  it('picks a plural branch by count, with exact matches first', () => {
    const text = '{count, plural, =0 {No videos} one {# video} other {# videos}}';

    assert.deepEqual(format(text, { count: 0 }), ['No videos']);
    assert.deepEqual(format(text, { count: 1 }), ['1 video']);
    assert.deepEqual(format(text, { count: 1200 }), ['1,200 videos']);
  });

  it('reads values inside a plural branch', () => {
    const text = '{count, plural, one {{views} view} other {{views} views}}';

    assert.deepEqual(format(text, { count: 1, views: '1' }), ['1 view']);
    assert.deepEqual(format(text, { count: 1290000, views: '1.2M' }), ['1.2M views']);
  });

  it('uses the other branch in a language without plural forms', () => {
    assert.deepEqual(format('{count, plural, one {# video} other {# videos}}', { count: 1 }, 'ko'), ['1 videos']);
  });

  it('keeps a value that is not text, such as an element, as its own part', () => {
    const element = { type: 'code' };

    assert.deepEqual(format('Saves to the {folder} folder.', { folder: element }), ['Saves to the ', element, ' folder.']);
  });

  it('shows a missing value as its placeholder', () => {
    assert.deepEqual(format('Removed {title}.', {}), ['Removed {title}.']);
  });

  it('rejects arguments it does not support', () => {
    assert.throws(() => format('{kind, select, a {A} other {B}}', { kind: 'a' }), SyntaxError);
    assert.throws(() => format('{count, plural, one {# video}}', { count: 1 }), SyntaxError);
    assert.throws(() => format('Unclosed {title', {}), SyntaxError);
  });

  it('lists the values a message reads', () => {
    assert.deepEqual(listArguments('{title}: {count, plural, one {# video} other {{views} videos}}'), ['title', 'count', 'views']);
  });
});

describe('createTranslator', () => {
  const { t, tParts } = createTranslator({
    locale: 'ko',
    messages: { list: { meta: '{count}개' } },
    fallback: { list: { meta: '{count} videos', whole: 'All videos' } },
  });

  it('reads the locale first, then the fallback, then shows the key', () => {
    assert.equal(t('list.meta', { count: 3 }), '3개');
    assert.equal(t('list.whole'), 'All videos');
    assert.equal(t('list.missing'), 'list.missing');
  });

  it('returns parts for messages that carry elements', () => {
    assert.deepEqual(tParts('list.meta', { count: 3 }), ['3개']);
  });
});

describe('resolveLocale', () => {
  const options = { supported: ['en', 'ko'], base: 'en' };

  it('matches the primary language of a tag, and falls back to the base', () => {
    assert.equal(resolveLocale({ tag: 'ko-KR', ...options }), 'ko');
    assert.equal(resolveLocale({ tag: 'en_GB', ...options }), 'en');
    assert.equal(resolveLocale({ tag: 'fr', ...options }), 'en');
    assert.equal(resolveLocale({ tag: undefined, ...options }), 'en');
  });

  it('speaks the base locale outside Chrome', () => {
    assert.equal(locale, BASE_LOCALE);
  });
});

describe('message files', () => {
  const base = MESSAGES[BASE_LOCALE];
  const baseKeys = listKeys(base);

  it('use one-level groups and kebab-case keys', () => {
    for (const key of baseKeys) {
      assert.match(key, /^[a-z]+(-[a-z]+)*\.[a-z0-9]+(-[a-z0-9]+)*$/, key);
    }
  });

  for (const [tag, messages] of Object.entries(MESSAGES)) {
    it(`${tag}: has exactly the keys of the base locale, each a message that parses`, () => {
      assert.deepEqual(listKeys(messages).sort(), [...baseKeys].sort());

      for (const key of baseKeys) {
        const text = readMessage(messages, key);

        assert.equal(typeof text, 'string', key);
        assert.ok(text.trim(), `${tag} ${key} is empty`);
        assert.doesNotThrow(() => listArguments(text), key);
      }
    });

    it(`${tag}: reads only values the base message provides`, () => {
      for (const key of baseKeys) {
        const provided = new Set(listArguments(readMessage(base, key)));

        for (const name of listArguments(readMessage(messages, key))) {
          assert.ok(provided.has(name), `${tag} ${key} reads {${name}}`);
        }
      }
    });

    it(`${tag}: keeps the manifest description within Chrome's limit`, () => {
      assert.ok(messages.manifest.description.length <= MANIFEST_DESCRIPTION_MAX);
    });
  }

  it('cover every key the source uses, and hold no key it does not use', () => {
    const used = findUsedKeys();
    const manifest = readFileSync(path.join(ROOT, 'manifest.json'), 'utf8');

    for (const key of used) {
      assert.ok(baseKeys.includes(key), `${key} is used but has no message`);
    }

    for (const key of baseKeys) {
      if (key.startsWith('manifest.')) {
        assert.ok(manifest.includes(`__MSG_${key.replaceAll(/[.-]/g, '_')}__`), `${key} is not in manifest.json`);
      } else {
        assert.ok(used.has(key), `${key} is not used`);
      }
    }
  });
});

describe('Korean messages', () => {
  const { t } = createTranslator({ locale: 'ko', messages: MESSAGES.ko, fallback: MESSAGES[BASE_LOCALE] });

  it('write counts and view counts the Korean way', () => {
    assert.equal(t('list.meta', { count: 1234, duration: '3시간' }), '1,234개 · 3시간');
    assert.equal(t('format.views', { count: 13495151, views: '1349만' }), '조회수 1349만회');
  });
});
