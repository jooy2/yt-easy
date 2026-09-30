// Loads the content scripts into an isolated context, the way Chrome loads
// them into a page, with only the globals a test chooses to provide.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const FILES = ['selectors.js', 'util.js', 'page.js', 'collector.js'];

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

  for (const file of FILES) {
    const source = readFileSync(new URL(`../../src/content/${file}`, import.meta.url), 'utf8');

    vm.runInContext(source, context, { filename: file });
  }

  return context.ytEasy;
};

// Values created inside the context have that context's prototypes, which
// strict deep equality rejects. Comparing plain copies avoids that.
export const plain = (value) => JSON.parse(JSON.stringify(value));
