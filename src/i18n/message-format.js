// Formats messages written in the small part of ICU MessageFormat that this
// extension's copy needs:
//
//   {name}                                   inserts a value
//   {count, plural, =0 {…} one {…} other {…}} picks a branch by count; `=N`
//                                            matches one number exactly, and
//                                            `#` in a branch is the count
//
// Apostrophes are plain text, and braces cannot be escaped.

const parsed = new Map();
const numberFormats = new Map();
const pluralRules = new Map();

const readCached = (cache, key, create) => {
  if (!cache.has(key)) {
    cache.set(key, create());
  }

  return cache.get(key);
};

const formatNumber = (value, locale) => readCached(numberFormats, locale, () => new Intl.NumberFormat(locale)).format(value);

const selectPlural = (value, locale) => readCached(pluralRules, locale, () => new Intl.PluralRules(locale)).select(value);

// Reads nodes from `start` until the end of the text or, inside a plural
// branch, until the `}` that closes the branch. Returns [nodes, index].
const parseNodes = (text, start, inBranch) => {
  const nodes = [];
  let buffer = '';
  let index = start;

  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = '';
    }
  };

  while (index < text.length) {
    const char = text[index];

    if (char === '}' && inBranch) {
      break;
    }

    if (char === '{') {
      flush();

      const [node, next] = parseArgument(text, index + 1);

      nodes.push(node);
      index = next;
      continue;
    }

    if (char === '#' && inBranch) {
      flush();
      nodes.push({ type: 'count' });
    } else {
      buffer += char;
    }

    index += 1;
  }

  flush();

  return [nodes, index];
};

// Reads one argument after its `{`. Returns [node, index after its `}`].
const parseArgument = (text, start) => {
  const close = text.indexOf('}', start);
  const comma = text.indexOf(',', start);

  if (close === -1) {
    throw new SyntaxError(`Unclosed argument in "${text}".`);
  }

  if (comma === -1 || close < comma) {
    return [{ type: 'value', name: text.slice(start, close).trim() }, close + 1];
  }

  const typeEnd = text.indexOf(',', comma + 1);
  const name = text.slice(start, comma).trim();
  const type = typeEnd === -1 ? '' : text.slice(comma + 1, typeEnd).trim();

  if (type !== 'plural') {
    throw new SyntaxError(`Only plural arguments are supported, in "${text}".`);
  }

  const options = {};
  let index = typeEnd + 1;

  while (true) {
    while (/\s/.test(text[index] ?? '')) {
      index += 1;
    }

    if (text[index] === '}') {
      break;
    }

    const open = text.indexOf('{', index);

    if (open === -1) {
      throw new SyntaxError(`Unclosed plural argument in "${text}".`);
    }

    const [nodes, end] = parseNodes(text, open + 1, true);

    if (text[end] !== '}') {
      throw new SyntaxError(`Unclosed plural branch in "${text}".`);
    }

    options[text.slice(index, open).trim()] = nodes;
    index = end + 1;
  }

  if (!options.other) {
    throw new SyntaxError(`A plural argument needs an "other" branch, in "${text}".`);
  }

  return [{ type: 'plural', name, options }, index + 1];
};

export const parseMessage = (text) => readCached(parsed, text, () => parseNodes(text, 0, false)[0]);

// The names of the values a message reads, in order of first use.
export const listArguments = (text) => {
  const names = new Set();

  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'value' || node.type === 'plural') {
        names.add(node.name);
      }

      if (node.type === 'plural') {
        Object.values(node.options).forEach(visit);
      }
    }
  };

  visit(parseMessage(text));

  return [...names];
};

const formatValue = (value, name, locale) => {
  if (typeof value === 'number') {
    return formatNumber(value, locale);
  }

  // A missing value is a bug; showing the placeholder makes it visible.
  return value ?? `{${name}}`;
};

const formatNodes = ({ nodes, values, locale, count }) => nodes.flatMap((node) => {
  if (typeof node === 'string') {
    return [node];
  }

  if (node.type === 'count') {
    return [formatNumber(count, locale)];
  }

  if (node.type === 'value') {
    return [formatValue(values[node.name], node.name, locale)];
  }

  const value = Number(values[node.name]);
  const branch = node.options[`=${value}`] ?? node.options[selectPlural(value, locale)] ?? node.options.other;

  return formatNodes({ nodes: branch, values, locale, count: value });
});

// Returns the formatted message as parts: strings, with any value that is
// not a string or a number, such as a React element, left as it is.
export const formatMessage = ({ text, values = {}, locale }) => formatNodes({ nodes: parseMessage(text), values, locale })
  .reduce((parts, part) => {
    if (typeof part === 'string' && typeof parts.at(-1) === 'string') {
      parts[parts.length - 1] += part;
    } else {
      parts.push(part);
    }

    return parts;
  }, []);

// Picks the supported locale for a language tag such as "ko-KR", by its
// primary language, or the base locale when none matches.
export const resolveLocale = ({ tag, supported, base }) => {
  const language = String(tag ?? '').split(/[-_]/)[0].toLowerCase();

  return supported.includes(language) ? language : base;
};

// `messages` maps a group to its keys, as in the message files. A key missing
// from `messages` falls back to `fallback`, and a key missing from both is
// shown as it is.
export const createTranslator = ({ locale, messages, fallback = {} }) => {
  const lookup = (key) => {
    const [group, name] = key.split('.');

    return messages[group]?.[name] ?? fallback[group]?.[name];
  };

  const tParts = (key, values) => {
    const text = lookup(key);

    return text === undefined ? [key] : formatMessage({ text, values, locale });
  };

  const t = (key, values) => tParts(key, values).join('');

  return { t, tParts };
};
