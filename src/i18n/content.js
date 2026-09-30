// Bundled into `src/content/i18n.js`, the first content script, so the ones
// after it read their copy from `ytEasy.i18n`.
import { locale, t } from './runtime.js';

(globalThis.ytEasy ??= {}).i18n = { locale, t };
