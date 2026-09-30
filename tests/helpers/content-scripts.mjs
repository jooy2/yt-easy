// Loads the content scripts into an isolated context, the way Chrome loads
// them into a page, with only the globals a test chooses to provide.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { buildSync } from 'esbuild';

const FILES = ['selectors.js', 'util.js', 'page.js', 'collector.js'];

// `src/content/i18n.js` only exists in the build, so it is built here the
// same way. Without `chrome.i18n` it speaks the base locale, English.
const I18N_SCRIPT = buildSync({
  entryPoints: [fileURLToPath(new URL('../../src/i18n/content.js', import.meta.url))],
  bundle: true,
  format: 'iife',
  write: false,
}).outputFiles[0].text;

export const loadContentScripts = (globals = {}) => {
  const context = vm.createContext({
    console,
    URL,
    URLSearchParams,
    DOMException,
    TextEncoder,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    ...globals,
  });

  vm.runInContext(I18N_SCRIPT, context, { filename: 'i18n.js' });

  for (const file of FILES) {
    const source = readFileSync(new URL(`../../src/content/${file}`, import.meta.url), 'utf8');

    vm.runInContext(source, context, { filename: file });
  }

  return context.ytEasy;
};

// Values created inside the context have that context's prototypes, which
// strict deep equality rejects. Comparing plain copies avoids that.
export const plain = (value) => JSON.parse(JSON.stringify(value));
