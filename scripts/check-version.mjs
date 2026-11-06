// Checks that a release tag names the version in `manifest.json`,
// `package.json`, and `package-lock.json`, so the zip attached to a release
// carries the version its tag says. Prints the version when they match.
//
//   node scripts/check-version.mjs v0.2.0
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const VERSION_FILES = ['manifest.json', 'package.json', 'package-lock.json'];

const tag = process.argv[2] ?? '';

if (!/^v\d/.test(tag)) {
  console.error(`Pass the release tag, such as v0.2.0. Got "${tag}".`);
  process.exit(1);
}

const version = tag.slice(1);
const mismatches = VERSION_FILES.map((file) => {
  const found = JSON.parse(readFileSync(path.join(ROOT, file), 'utf8')).version;

  return { file, found };
}).filter(({ found }) => found !== version);

if (mismatches.length > 0) {
  for (const { file, found } of mismatches) {
    console.error(`${file} has version ${found}, but the tag is ${tag}.`);
  }

  process.exit(1);
}

console.log(version);
