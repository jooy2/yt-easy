// The language the extension speaks, and the functions that read its copy.
// Every message lives in `messages/`: English is the base, and every other
// file carries the same keys.
import { createTranslator, resolveLocale } from './message-format.js';
import en from './messages/en.json' with { type: 'json' };
import ko from './messages/ko.json' with { type: 'json' };

export const BASE_LOCALE = 'en';
export const MESSAGES = Object.freeze({ en, ko });

// Chrome's UI language, which also picks the extension's name and description
// on chrome://extensions. Outside Chrome, as in the tests, it is the base.
export const locale = resolveLocale({
  tag: globalThis.chrome?.i18n?.getUILanguage?.(),
  supported: Object.keys(MESSAGES),
  base: BASE_LOCALE,
});

export const { t, tParts } = createTranslator({ locale, messages: MESSAGES[locale], fallback: MESSAGES[BASE_LOCALE] });
