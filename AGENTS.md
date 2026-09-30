# yt-easy

Guidance for AI agents (and humans) working in this repository. Written in English to match the repository's other documents.

## What this repository is

A Chrome extension (Manifest V3) for managing the signed-in account's YouTube "Watch later" list: collect it, group and filter it, export it, and remove many videos at once. It is a personal tool, installed unpacked and not published on the Chrome Web Store.

The YouTube Data API returns an empty list for Watch later, so the extension works in the signed-in browser instead: it reads the Watch later page and clicks through its menus the way a person would.

`npm run build` bundles the manager page with esbuild and writes the loadable extension to `dist/`, which is what **Load unpacked** points at. `dist/` is generated and never committed. Tests run with Node.js's built-in test runner (`npm test`).

## Layout

```text
manifest.json          Permissions, content scripts, side panel
scripts/build.mjs      Builds dist/: bundles the manager, copies everything else
icons/                 logo.png is the source; the icon PNGs are resized from it
src/background.js      Opens the side panel from the toolbar icon
src/content/           Content scripts on www.youtube.com (classic scripts)
  selectors.js           Everything that depends on YouTube's markup and data
  util.js                Timing and parsing helpers
  page.js                DOM helpers for the Watch later page
  collector.js           Collects the list from page data, or by scrolling
  remover.js             Removes videos through each row's menu
  overlay.js             Progress card shown on the Watch later page
  main.js                Ping and job messages from the manager
src/manager/           Side panel page, bundled by esbuild; also openable in a tab
  main.jsx               Entry: neba providers and styles
  App.jsx                State, and the scan, export, category, and removal flows
  components/            React components built from neba
  hooks/                 Stored data and the running task
  lib/                   Plain modules without React: filtering, export, storage, messaging
tests/                 node --test; fixtures are synthetic
dist/                  Build output, loaded into Chrome (not committed)
```

## How the pieces talk

- The manager finds or opens the Watch later tab (`tab-bridge.js`), pings its content script, and runs one job over a port named `yt-easy-job`. Commands are `collect` and `remove`; the content script answers with `progress`, then `done`, `error`, or `cancelled`.
- Closing the manager closes the port, and the content script cancels the job. Nothing runs unattended.
- The content scripts share one namespace, `globalThis.ytEasy`, and load in the order listed in `manifest.json`. A file may only use what an earlier file defined, unless it reads it lazily inside a function.
- Only the manager writes to `chrome.storage.local`. Everything the content script returns is checked in `src/manager/lib/snapshot.js` before it is stored or shown.

## Rules

These are not style preferences. A change that breaks one of them does not get merged.

1. **Keep YouTube-specific details in `src/content/selectors.js`.** DOM selectors, page data keys, and menu labels go there, so a YouTube redesign is fixed in one file. List the current markup first and keep the older one as a fallback.
1. **Work at a person's pace.** Removal waits at least one second between videos (`SETTINGS_LIMITS.delayMin`, and `DELAY_MIN_LIMIT` in `main.js`). Collection waits between continuation requests. Do not remove these pauses or run requests in parallel.
1. **Touch only the user's own Watch later list.** Do not collect or send anything else, and do not add analytics or remote logging.
1. **Remove through the page's own menu.** Deletion is UI automation on the Watch later page by design. Verify each removal by checking that the row is gone, and stop the job when the page does not behave as expected.
1. **Keep permissions minimal.** A new permission needs a reason. Hosts that only some users need are `optional_host_permissions`, requested when the feature is turned on.
1. **Offer a backup before removing.** The removal dialog has a backup switch, off by default. When it is on, the removal starts only after the JSON and CSV backups are saved.
1. **The UI is Korean.** Everything a user sees is written in Korean. Code, comments, and documents are in English.
1. **Build the manager from neba.** Use [neba](https://neba.cdget.com) components before writing a control by hand, and style custom parts with neba's CSS tokens (`--neba-*`) so light and dark mode keep working. Logic that does not need React belongs in `src/manager/lib/`, where the tests can reach it.

## Checking a change

```bash
npm run build
```

```bash
npm test
```

The collector tests load the content scripts into a `vm` context with synthetic page data shaped like YouTube's. When YouTube changes its data, update the fixtures in `tests/helpers/fixtures.mjs` together with the parser.

Behavior on the real page cannot be covered by these tests. After changing `selectors.js`, `page.js`, `collector.js`, or `remover.js`, load the extension, collect the list, and run a removal with **드라이런** turned on before removing anything for real.

## Commit conventions

Follow the existing history: `tag: message`, in English, in the imperative. Tags follow the Udacity Git style (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`) plus the informal `package` and `typo`. Wrap paths and identifiers in backticks, and add `(fixes #1)` when an issue tracks the change.
