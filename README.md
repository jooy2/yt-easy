<img src=".github/resources/yt-easy-logo.webp" alt="yt-easy" width="112" height="112">

# yt-easy

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/yt-easy/blob/main/LICENSE) [![Test](https://github.com/jooy2/yt-easy/actions/workflows/test.yml/badge.svg)](https://github.com/jooy2/yt-easy/actions/workflows/test.yml) ![Repository size](https://img.shields.io/github/repo-size/jooy2/yt-easy) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/yt-easy) [![Followers](https://img.shields.io/github/followers/jooy2?style=social)](https://github.com/jooy2) ![Stars](https://img.shields.io/github/stars/jooy2/yt-easy?style=social)

**yt-easy** is a Chrome extension for sorting out your YouTube "Watch later" list and your playlists. It shows a list grouped by channel or by length, lets you search and sort it, exports it, and removes many videos at once.

The YouTube Data API has returned an empty list for Watch later since 2016, so a tool built on the API cannot read it. yt-easy works inside the browser you are signed in to instead: it reads the Watch later page the way the page reads itself, and removes videos by clicking through the same menu you would.

> yt-easy is a personal tool. It is not published on the Chrome Web Store, and it is not affiliated with or endorsed by YouTube or Google.

## Features

- Scans Watch later or any playlist by its address, including lists of several thousand videos, and keeps each scanned list so you can switch between them: video ID, title, channel name, channel ID, length, thumbnail, and position in the list.
- Groups the list by channel or by length range, with ranges you set yourself.
- Searches titles and channel names, and sorts by list order, length, or channel name.
- Shows how much of each video you have watched, and filters by it.
- Selects videos one by one, a whole group at once, the whole list, or everything the current search and filters show.
- Removes the selected videos one at a time, with a random pause between them, a progress bar, and a cancel button. Videos that could not be removed are marked in the list.
- Can save the videos about to be removed as JSON and CSV before anything is removed.
- Offers a test mode that handles only the first few videos, and a dry run that finds the remove menu without clicking it.
- Exports the whole list as JSON or CSV.
- Shows each video's category, publish date, and view count, and sorts, groups, and filters by them, if you supply a YouTube Data API key.

The interface is in English and Korean, and follows the language of Chrome.

## How it works

- **Scanning**: the extension fetches the page of the list (Watch later is the playlist `WL`), reads the first 100 videos from the data embedded in it, and requests the rest 100 at a time with the same request the page sends while you scroll, pausing about a second between requests. This works while the tab is in the background and does not need thousands of rows drawn on screen. If the page data cannot be read, the extension scrolls the list's tab to the end and reads the rows instead.
- **Removing**: on the list's page, the extension opens each video's menu and chooses the remove entry, as a person would, then checks that the row disappeared before moving on.
- **Storing**: the scanned lists and the settings are kept in the extension's storage in your Chrome profile. Up to six lists, with 20,000 videos in all, are kept; Watch later and the list scanned last always stay, and the oldest others make room.
- **The manager** is built with React and the [neba](https://neba.cdget.com) component library, and only the rows on screen are drawn, so a list of thousands of videos scrolls smoothly.

## Install

The extension is built from source before it is loaded. You need [Node.js](https://nodejs.org/) 22.12 or newer.

1. Clone this repository and open a terminal in it.
1. Install the dependencies and build the extension. The build writes the loadable extension to `dist/`.

   ```bash
   npm install
   ```

   ```bash
   npm run build
   ```

1. Open `chrome://extensions` in Chrome 116 or newer.
1. Turn on **Developer mode** in the top-right corner.
1. Click **Load unpacked** and select the `dist` folder inside the repository.
1. Pin the extension from the puzzle icon in the toolbar, so that its icon stays at hand.

To update, pull the latest changes, run `npm install` and `npm run build` again, click the reload button on the extension's card in `chrome://extensions`, and reload any open YouTube tab.

## Usage

Sign in to YouTube in Chrome first. Click the extension's icon to open the manager in the side panel. **Open in a new tab** opens the same manager in a full tab when you want more room.

### Scan the list

Click **Start scan**, at the top of the manager or in the middle of the empty list on first use. The manager opens the page of the list in a tab if none is open, reads the list, and keeps it in the extension's storage. A list of 5,000 videos takes one to two minutes.

The stored list does not follow changes you make on YouTube. Scan again after you change the list there.

### Scan a playlist

The name of the list at the top of the manager opens a menu of the lists you have scanned, starting with Watch later. Choose one to show it again without a new scan.

To add a playlist, choose **Add a playlist…** and paste the address of the playlist page, such as `https://www.youtube.com/playlist?list=…`. A video address that carries `list=`, or the ID alone, works too. The manager scans it and shows it once the scan succeeds.

- Videos can be removed from your own playlists and from Watch later. For anyone else's playlist, scanning, filtering, and export work, and **Remove selected** stays disabled.
- A public playlist can be scanned while signed out. A private one needs the account it belongs to.
- **Remove this list from history** in the same menu drops a scanned playlist from the manager. It does not change anything on YouTube.

### Find what you want

- The sort menu sorts by **Date added**, which is the order of the list on YouTube, **Publish date**, **View count**, **Channel name**, **Length**, or **Category**. The button next to it switches between ascending and descending. The publish date, the view count, and the category come from the YouTube Data API, so those three sorts need an API key; see below.
- Sorting by channel name, length, or category also lists the channels, the length ranges, or the categories as tabs down the left side. Choosing one shows only its videos on the right, and **All** shows all of them. Above the channel and category tabs, **Name** and **Count** order them by name or by number of videos. Drag the line between the tabs and the list to resize them, and use the arrow keys to move between groups.
- The length menu shows a single length range. Change the ranges in **Settings**.
- The watch status menu narrows the list by how much of each video you have watched: **Not watched**, **Partly watched** (under 90%), or **Watched** (90% or more). The amount comes from the red bar YouTube draws under a thumbnail, and the rows show the same bar. It follows your YouTube watch history, so with the history paused or turned off, every video counts as not watched.
- The search box matches every word you type against titles and channel names.
- The filter button at the top folds the search box and the options away, so the list gets more room. A dot on the button shows that a search or a filter still narrows the list.

### Open a video

Each row ends with two buttons. The first, **Open in this tab**, loads the video in the tab the side panel sits beside when that tab is on YouTube. When it shows another site, or when the manager is open in its own tab, the video opens in a new tab instead, so no other page is replaced. The button is disabled while a scan or a removal runs, because that tab may be the list's tab the job works in. The second button, **Open in a new tab**, always opens a new tab.

Clicking anywhere else on a row selects it, so opening a video never changes the selection.

### Remove videos

1. Select videos by clicking their rows or checkboxes. Shift+click selects every video between the last one you clicked and this one, or clears them if you had just cleared that one. The checkbox at the top of the list, or ⌘+A (Ctrl+A on Windows and Linux), selects every video the list shows: the chosen group, narrowed by the search and filters. **Select all** selects the whole list, and Esc clears the selection.
1. Click **Remove selected** and check the list in the dialog.
1. The first time, turn on **Dry run**. It opens each video's menu and finds the remove entry without clicking it, which shows that removal works with your YouTube layout and language. Then turn on **Test mode** to remove only the first few videos, and check the result on YouTube.
1. Click **Start removing**.

To keep a copy of what you remove, turn on **Save the list as backup files before removing** in the dialog. The manager then saves the selected videos as `wl-delete-backup-<date>-<time>.json` and `.csv` in the `yt-easy` folder of your Downloads folder, and starts removing only after both files are saved. The switch is off each time the dialog opens.

The list's tab then comes to the front and shows a progress card. Keep that tab on screen until the job finishes: Chrome pauses pages in background tabs, and the removal pauses with them. Do not scroll or click on the page while it runs. You can cancel from the manager or from the card, and closing the manager cancels the job too.

Videos are removed in list order, one at a time. The job stops on its own when three videos in a row fail, when the tab leaves the list's page, or when a row other than the target disappears. At the end, a dialog lists the failures with their reasons, and **Select failed only** selects them for another try.

### Export

**Export** at the top saves the whole list as a JSON or a CSV file in the `yt-easy` folder of your Downloads folder, including the category, publish date, and view count of each video that has been looked up. The CSV is UTF-8 with a byte order mark, so spreadsheet apps show titles in any language correctly.

### Categories, publish dates, and view counts (optional)

The page does not show a video's category or its exact publish date and view count, so these come from the YouTube Data API and need an API key you create:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project, enable **YouTube Data API v3**, and create an API key. Under the key's restrictions, allow only YouTube Data API v3, and leave the application restriction at none: the extension sends no referrer, so a website restriction would reject it.
1. Paste the key into **Settings** > **YouTube Data API key** and save. Chrome then asks for access to `www.googleapis.com`; the extension does not request it before this point.
1. Click **Look up video info** in the filter row. The manager looks up 50 videos per request and remembers the results, so the next lookup only covers new videos. Looking up 5,000 videos takes 100 requests, which uses 100 units of the default daily quota of 10,000. The category names come from one more request.

With the information in place:

- The category menu filters by any category found in the list, such as **Music** or **Gaming**, and also offers **Not music** and **Unknown category**. The category names come in the language of the manager. When Chrome's language changes, the manager asks for the names again the next time it opens, with the key and the access you already gave; that request sends nothing from your list.
- **Publish date**, **View count**, and **Category** become available in the sort menu. The rows show the date or the view count while the list is sorted by it, and the category of each video as a badge.
- A view count is the count at the moment it was looked up. Once every video has been looked up, the button reads **Refresh view counts** and looks all of them up again.
- A video that has not been looked up yet, or that the API has no record of, goes last in these sorts and counts as **Unknown category**.

## Settings

| Setting                          | Default     | Notes                                                                           |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| Length range bounds (minutes)    | `5, 20, 60` | Up to 8 bounds; `5, 20, 60` gives under 5, 5–20, 20–60, and 60 minutes and over |
| Pause between removals (seconds) | 1 to 2      | A random pause in this range after each video, at least 1 second                |
| Default count for test mode      | 3           | How many videos test mode handles, from 1 to 50                                 |
| YouTube Data API key             | empty       | Used only to look up categories, publish dates, and view counts                 |

## Permissions

| Permission                     | Why                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `https://www.youtube.com/*`    | Reads Watch later and playlist pages, and clicks their menus                         |
| `storage`                      | Keeps the collected list, the settings, and the category cache on this computer      |
| `sidePanel`                    | Shows the manager in the side panel                                                  |
| `downloads`                    | Saves export and backup files, and confirms that a backup is complete before removal |
| `https://www.googleapis.com/*` | Optional; requested only when you save an API key                                    |

## Privacy

- Everything the extension keeps stays in your Chrome profile. It has no server of its own.
- Requests to YouTube are the ones a playlist page itself makes for the list you chose to scan, sent from the YouTube tab. How much of a video you watched is part of that list; the extension does not read your watch history.
- With an API key, the IDs of the videos in your list are sent to the YouTube Data API to look up their categories, publish dates, and view counts, and nothing else is.
- The API key is stored in plain text in the extension's storage, like any other setting. [SECURITY.md](SECURITY.md) has the details.

## Troubleshooting

- **"You are not signed in to YouTube"**: sign in to YouTube in this Chrome profile, then scan again.
- **"Could not connect to the YouTube tab"**: reload the list's tab. A tab that was open before the extension was installed or reloaded has no content script until it loads again. The manager tries one reload by itself first.
- **A playlist cannot be scanned**: the manager shows YouTube's own message, such as a playlist that does not exist or is private. Check the address, and sign in to the account the playlist belongs to.
- **Scanning switches to scrolling**: when the page data cannot be read, the manager brings the list's tab to the front and scrolls it to the end instead. This is slower, and a channel may be recorded by its handle instead of its channel ID.
- **"Could not find the remove entry in the menu"**: YouTube changed its menu, or shows it in a language the extension does not know. The manager reads the label of the remove entry from the page data while scanning, so scan again first. If removal still fails, add your label to `REMOVE_MENU_LABELS` in `src/content/selectors.js`.
- **Anything else after a YouTube redesign**: every selector and data key that depends on YouTube lives in `src/content/selectors.js`. Run a dry run after changing it.
- A YouTube playlist holds at most 5,000 videos. Unavailable videos, such as deleted or private ones, may be hidden from a playlist page and are then not collected.

## Development

`npm run watch` rebuilds `dist/` whenever a file changes, without minifying and with source maps. After a rebuild, click the reload button of the extension in `chrome://extensions`, and reload the YouTube tab when a content script changed.

```bash
npm run watch
```

The tests use Node.js's built-in test runner. They are run with Node.js 24, as in CI.

```bash
npm test
```

`dist/THIRD_PARTY_NOTICES.txt` lists the packages bundled into the build, with their licenses.

Every message the extension shows lives in `src/i18n/messages/`. `en.json` is the base, and `ko.json` carries the same keys in Korean. The manager and the content scripts pick the file that matches the language of Chrome, and fall back to English for any other language. The extension's description and toolbar title come from the `manifest` group, which the build writes to `_locales`.

[AGENTS.md](AGENTS.md) describes the layout and the rules a change has to follow.

## Contributing

Anyone can contribute to the project by reporting new issues or submitting a pull request. For more information, please see [CONTRIBUTING.md](CONTRIBUTING.md). Participation is subject to the [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security issue, please follow the process described in [SECURITY.md](SECURITY.md).

## Author

CDGet · [cdget.com](https://cdget.com) · [Contact](https://cdget.com/contact)

## License

Please see the [LICENSE](LICENSE) file for more information about project owners, usage rights, and more.
