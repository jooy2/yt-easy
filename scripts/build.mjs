// Builds the loadable extension into `dist/`.
//
//   npm run build            minified build
//   npm run build -- --dev   readable build with source maps
//   npm run watch            readable build, rebuilt on every change
//
// The manager page is bundled with esbuild. The service worker and the
// content scripts are plain scripts that Chrome loads as they are, so they
// are copied without changes, and so is the manifest.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import * as esbuild from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'dist');
const FLAGS = new Set(process.argv.slice(2));
const IS_WATCH = FLAGS.has('--watch');
const IS_DEV = IS_WATCH || FLAGS.has('--dev');

const MANAGER_ENTRY = 'src/manager/app.js';
const STATIC_ENTRIES = [
  'manifest.json',
  'icons',
  'src/background.js',
  'src/content',
  'src/manager/manager.html',
  'src/manager/manager.css',
];
const LICENSE_FILE_PATTERN = /^(licen[cs]e|copying)(\.|$)/i;

const copyStatic = () => {
  for (const entry of STATIC_ENTRIES) {
    cpSync(path.join(ROOT, entry), path.join(OUT, entry), {
      recursive: true,
      // The SVG is only the source the PNG icons are drawn from.
      filter: (source) => !source.endsWith('.svg'),
    });
  }
};

// The folder of the package a bundled file came from, relative to the
// project. The innermost `node_modules` wins, so a nested copy of a package
// is read from its own folder rather than from the top-level one.
const readPackageFolder = (input) => {
  const index = input.lastIndexOf('node_modules/');

  if (index === -1) {
    return null;
  }

  const [scopeOrName, name] = input.slice(index + 'node_modules/'.length).split('/');
  const packagePath = scopeOrName.startsWith('@') ? `${scopeOrName}/${name}` : scopeOrName;

  return `${input.slice(0, index)}node_modules/${packagePath}`;
};

// The MIT and similar licenses of the bundled packages ask for their notice
// to travel with the code, so the notices are collected next to the bundle.
const writeNotices = (metafile) => {
  const folders = [...new Set(Object.keys(metafile.inputs).map(readPackageFolder).filter(Boolean))].sort();

  if (folders.length === 0) {
    return;
  }

  const sections = folders.map((folder) => {
    const absolute = path.join(ROOT, folder);
    const manifest = JSON.parse(readFileSync(path.join(absolute, 'package.json'), 'utf8'));
    const licenseFile = readdirSync(absolute).find((file) => LICENSE_FILE_PATTERN.test(file));
    const text = licenseFile ? readFileSync(path.join(absolute, licenseFile), 'utf8').trim() : `License: ${manifest.license}`;

    return `${manifest.name}@${manifest.version} (${manifest.license})\n\n${text}`;
  });

  writeFileSync(
    path.join(OUT, 'THIRD_PARTY_NOTICES.txt'),
    `This extension bundles the following packages.\n\n${sections.join('\n\n---\n\n')}\n`,
  );
};

const afterBuildPlugin = {
  name: 'after-build',
  setup: (build) => {
    build.onEnd((result) => {
      if (result.errors.length > 0) {
        return;
      }

      copyStatic();
      writeNotices(result.metafile);
    });
  },
};

const options = {
  entryPoints: { 'src/manager/app': path.join(ROOT, MANAGER_ENTRY) },
  outdir: OUT,
  absWorkingDir: ROOT,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome116'],
  jsx: 'automatic',
  minify: !IS_DEV,
  sourcemap: IS_DEV ? 'linked' : false,
  // License comments are collected into THIRD_PARTY_NOTICES.txt instead.
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': JSON.stringify(IS_DEV ? 'development' : 'production') },
  metafile: true,
  logLevel: 'info',
  plugins: [afterBuildPlugin],
};

if (existsSync(OUT)) {
  rmSync(OUT, { recursive: true, force: true });
}

if (IS_WATCH) {
  const context = await esbuild.context(options);

  await context.watch();
} else {
  await esbuild.build(options);
}
