<img src="icons/icon-128.png" alt="yt-easy" width="112" height="112">

# yt-easy

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/jooy2/yt-easy/blob/main/LICENSE) [![Test](https://github.com/jooy2/yt-easy/actions/workflows/test.yml/badge.svg)](https://github.com/jooy2/yt-easy/actions/workflows/test.yml) ![Repository size](https://img.shields.io/github/repo-size/jooy2/yt-easy) ![Commit Count](https://img.shields.io/github/commit-activity/y/jooy2/yt-easy) [![Followers](https://img.shields.io/github/followers/jooy2?style=social)](https://github.com/jooy2) ![Stars](https://img.shields.io/github/stars/jooy2/yt-easy?style=social)

**yt-easy** is a Chrome extension for sorting out your YouTube "Watch later" list. It shows the list grouped by channel or by length, lets you search and sort it, exports it, and removes many videos at once.

The YouTube Data API has returned an empty list for Watch later since 2016, so a tool built on the API cannot read it. yt-easy works inside the browser you are signed in to instead: it reads the Watch later page the way the page reads itself, and removes videos by clicking through the same menu you would.

> yt-easy is a personal tool. It is not published on the Chrome Web Store, and it is not affiliated with or endorsed by YouTube or Google.

## Features

- Collects the whole list, including lists of several thousand videos: video ID, title, channel name, channel ID, length, thumbnail, and position in the list.
- Groups the list by channel or by length range, with ranges you set yourself.
- Searches titles and channel names, and sorts by list order, length, or channel name.
- Selects videos one by one, a whole group at once, the whole list, or everything the current search and filters show.
- Removes the selected videos one at a time, with a random pause between them, a progress bar, and a cancel button. Videos that could not be removed are marked in the list.
- Saves the videos about to be removed as JSON and CSV before anything is removed.
- Offers a test mode that handles only the first few videos, and a dry run that finds the remove menu without clicking it.
- Exports the whole list as JSON or CSV.
- Tells music videos apart, if you supply a YouTube Data API key.

The interface is in Korean.

## How it works

- **Collecting**: the extension fetches the Watch later page, reads the first 100 videos from the data embedded in it, and requests the rest 100 at a time with the same request the page sends while you scroll, pausing about a second between requests. This works while the tab is in the background and does not need thousands of rows drawn on screen. If the page data cannot be read, the extension scrolls the Watch later tab to the end and reads the rows instead.
- **Removing**: on the Watch later page, the extension opens each video's menu and chooses the remove entry, as a person would, then checks that the row disappeared before moving on.
- **Storing**: the list and the settings are kept in the extension's storage in your Chrome profile.

## Install

1. Download or clone this repository.
1. Open `chrome://extensions` in Chrome 116 or newer.
1. Turn on **Developer mode** in the top-right corner.
1. Click **Load unpacked** and select the repository folder, the one that contains `manifest.json`.
1. Pin the extension from the puzzle icon in the toolbar, so that its icon stays at hand.

To update, pull the latest changes, click the reload button on the extension's card in `chrome://extensions`, and reload any open YouTube tab.

## Usage

Sign in to YouTube in Chrome first. Click the extension's icon to open the manager in the side panel. **새 탭에서 열기** opens the same manager in a full tab when you want more room.

### Collect the list

Click **목록 수집**. The manager opens the Watch later page in a tab if none is open, reads the list, and keeps it in the extension's storage. A list of 5,000 videos takes one to two minutes.

The stored list does not follow changes you make on YouTube. Collect again after you change the list there.

### Find what you want

- **보기** groups the list by channel, with the channels that have the most videos first, or by length.
- **정렬** sorts by list order (**추가순**), length, or channel name. The button next to it switches between ascending and descending.
- **길이** shows a single length range. Change the ranges in **설정**.
- The search box matches every word you type against titles and channel names.
- Click a group heading to fold it.

### Remove videos

1. Select videos with their checkboxes, a group's checkbox, **전체 선택**, or **검색 결과 선택**, which selects everything the current search and filters show.
1. Click **선택 항목 삭제** and check the list in the dialog.
1. The first time, turn on **드라이런**. It opens each video's menu and finds the remove entry without clicking it, which shows that removal works with your YouTube layout and language. Then turn on **테스트 모드** to remove only the first few videos, and check the result on YouTube.
1. Click **삭제 시작**.

Before removing anything, the manager saves the selected videos as `wl-delete-backup-<date>-<time>.json` and `.csv` in the `yt-easy` folder of your Downloads folder. It starts only after both files are saved.

The Watch later tab then comes to the front and shows a progress card. Keep that tab on screen until the job finishes: Chrome pauses pages in background tabs, and the removal pauses with them. Do not scroll or click on the page while it runs. You can cancel from the manager or from the card, and closing the manager cancels the job too.

Videos are removed in list order, one at a time. The job stops on its own when three videos in a row fail, when the tab leaves the Watch later page, or when a row other than the target disappears. At the end, a dialog lists the failures with their reasons, and **실패 항목만 선택** selects them for another try.

### Export

**JSON 내보내기** and **CSV 내보내기** save the whole list to the `yt-easy` folder of your Downloads folder. The CSV is UTF-8 with a byte order mark, so spreadsheet apps show Korean titles correctly.

### Tell music videos apart (optional)

YouTube does not show a video's category on the page, so this uses the YouTube Data API:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project, enable **YouTube Data API v3**, and create an API key. Restrict the key to that API.
1. Paste the key into **설정** > **YouTube Data API 키** and save. Chrome then asks for access to `www.googleapis.com`; the extension does not request it before this point.
1. Click **조회** next to **카테고리**. The manager looks up 50 videos per request and remembers the results, so the next lookup only covers new videos. Looking up 5,000 videos takes 100 requests, which uses 100 units of the default daily quota of 10,000.

Videos in category 10 (Music) get a **음악** badge, and the **카테고리** filter shows music only, everything else, or videos not looked up yet. Without a key, only this filter is disabled.

## Settings

| Setting                 | Default     | Notes                                                                           |
| ----------------------- | ----------- | ------------------------------------------------------------------------------- |
| 재생시간 구간 경계 (분) | `5, 20, 60` | Up to 8 bounds; `5, 20, 60` gives under 5, 5–20, 20–60, and 60 minutes and over |
| 삭제 간격 (초)          | 1 to 2      | A random pause in this range after each video, at least 1 second                |
| 테스트 모드 기본 개수   | 3           | How many videos test mode handles, from 1 to 50                                 |
| YouTube Data API 키     | empty       | Used only for the music category lookup                                         |

## Permissions

| Permission                     | Why                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `https://www.youtube.com/*`    | Reads the Watch later page and clicks its menus                                      |
| `storage`                      | Keeps the collected list, the settings, and the category cache on this computer      |
| `sidePanel`                    | Shows the manager in the side panel                                                  |
| `downloads`                    | Saves export and backup files, and confirms that a backup is complete before removal |
| `https://www.googleapis.com/*` | Optional; requested only when you save an API key                                    |

## Privacy

- Everything the extension keeps stays in your Chrome profile. It has no server of its own.
- Requests to YouTube are the ones the Watch later page itself makes for your own list, sent from the YouTube tab.
- With an API key, the IDs of the videos in your list are sent to the YouTube Data API to look up their categories, and nothing else is.
- The API key is stored in plain text in the extension's storage, like any other setting. [SECURITY.md](SECURITY.md) has the details.

## Troubleshooting

- **"YouTube에 로그인되어 있지 않습니다"**: sign in to YouTube in this Chrome profile, then collect again.
- **"YouTube 탭에 연결하지 못했습니다"**: reload the Watch later tab. A tab that was open before the extension was installed or reloaded has no content script until it loads again. The manager tries one reload by itself first.
- **Collection switches to scrolling**: when the page data cannot be read, the manager brings the Watch later tab to the front and scrolls it to the end instead. This is slower, and a channel may be recorded by its handle instead of its channel ID.
- **"메뉴에서 삭제 항목을 찾지 못했습니다"**: YouTube changed its menu, or shows it in a language the extension does not know. The manager reads the label of the remove entry from the page data while collecting, so collect again first. If removal still fails, add your label to `REMOVE_MENU_LABELS` in `src/content/selectors.js`.
- **Anything else after a YouTube redesign**: every selector and data key that depends on YouTube lives in `src/content/selectors.js`. Run a dry run after changing it.
- A YouTube playlist holds at most 5,000 videos. Unavailable videos, such as deleted or private ones, may be hidden from the Watch later page and are then not collected.

## Development

There is no build step. Edit the files, click the reload button of the extension in `chrome://extensions`, and reload the YouTube tab.

The tests use Node.js's built-in test runner and need no packages. They are run with Node.js 24, as in CI.

```bash
node --test
```

[AGENTS.md](AGENTS.md) describes the layout and the rules a change has to follow.

## Contributing

Anyone can contribute to the project by reporting new issues or submitting a pull request. For more information, please see [CONTRIBUTING.md](CONTRIBUTING.md). Participation is subject to the [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security issue, please follow the process described in [SECURITY.md](SECURITY.md).

## Author

CDGet · [cdget.com](https://cdget.com) · [Contact](https://cdget.com/contact)

## License

Please see the [LICENSE](LICENSE) file for more information about project owners, usage rights, and more.
