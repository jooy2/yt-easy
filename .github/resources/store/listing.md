# Chrome Web Store listing

The text to enter in the Chrome Web Store Developer Dashboard, in the order of its tabs, next to the images in this folder. When a feature, a permission, or the handling of data changes, update this file, [PRIVACY.md](../../../PRIVACY.md), and the dashboard together.

## Store listing tab

### Summary

The summary under the name comes from the manifest description, which the build takes from the `manifest` group of `src/i18n/messages/`. It cannot be edited in the dashboard.

```text
Sort, filter, export, and bulk-remove the videos in your YouTube Watch later list and playlists.
```

### Description in English

```text
yt-easy helps you sort out your YouTube Watch later list and your playlists. It reads the whole list, shows it grouped and sorted the way you want, exports it, and removes many videos at once.

The YouTube Data API does not return the Watch later list, so yt-easy works inside the browser you are already signed in to. It reads the list from the playlist page the way the page reads itself, and removes videos by choosing the same menu entry you would.

What you can do
- Scan Watch later or any playlist by its address, including lists of several thousand videos, and switch between the lists you scanned.
- Group videos by channel or by length range, with ranges you set yourself.
- Search titles and channel names, and sort by date added, channel, or length.
- See how much of each video you have watched, and filter by it.
- Select videos one by one, a whole group, or everything the current search shows, and remove them in one job with a progress bar and a cancel button.
- Try it safely first: a dry run finds the remove entry without clicking it, and test mode handles only the first few videos. You can also save the videos about to be removed as JSON and CSV files before anything is removed.
- Export the whole list as JSON or CSV.
- Optionally, add your own YouTube Data API key to see each video's category, publish date, and view count, and sort, group, and filter by them.

The manager opens in Chrome's side panel next to YouTube, or in a full tab. It is available in English and Korean.

How removal works
Videos are removed one at a time, in list order, with a pause of at least one second between them. The extension checks that each video is gone before it moves on, and stops on its own when YouTube does not behave as expected. Videos can be removed from Watch later and from your own playlists.

Privacy
- Everything yt-easy keeps, such as the scanned lists and your settings, stays in your Chrome profile. There is no yt-easy server and no analytics.
- yt-easy talks to YouTube only about the list you choose to scan or clean up, with the same requests the playlist page makes.
- If you add a YouTube Data API key, the IDs of the videos in your list are sent to the YouTube Data API to look up their details. Nothing is sent to the API until you add a key and allow access.
Privacy policy: https://github.com/jooy2/yt-easy/blob/main/PRIVACY.md

yt-easy is open source under the MIT License: https://github.com/jooy2/yt-easy
yt-easy is not affiliated with or endorsed by YouTube or Google.
```

### Description in Korean

Add Korean as a listing language and enter this text there. The summary switches to the Korean manifest description on its own.

```text
yt-easy는 YouTube '나중에 볼 동영상'과 재생목록을 정리하는 확장 프로그램입니다. 목록 전체를 읽어 원하는 방식으로 묶고 정렬해 보여 주고, 파일로 내보내고, 여러 영상을 한 번에 삭제합니다.

YouTube Data API는 '나중에 볼 동영상' 목록을 돌려주지 않습니다. 그래서 yt-easy는 이미 로그인한 브라우저 안에서 동작합니다. 재생목록 페이지가 목록을 읽는 방식 그대로 목록을 읽고, 사람이 누르는 것과 같은 메뉴 항목을 눌러 영상을 삭제합니다.

할 수 있는 일
- '나중에 볼 동영상'이나 주소로 지정한 재생목록을 스캔합니다. 영상이 수천 개인 목록도 읽을 수 있고, 스캔한 목록끼리 바꿔 가며 볼 수 있습니다.
- 채널별로, 또는 직접 정한 길이 구간별로 영상을 묶어 봅니다.
- 제목과 채널 이름을 검색하고, 추가된 날짜순·채널명순·길이순으로 정렬합니다.
- 영상마다 얼마나 봤는지 보여 주고, 시청 여부로 걸러 봅니다.
- 영상을 하나씩, 그룹 전체를, 또는 지금 검색 결과 전체를 골라 한 번에 삭제합니다. 진행 막대로 진행 상황을 보고 언제든 취소할 수 있습니다.
- 먼저 안전하게 시험해 볼 수 있습니다. 드라이런은 삭제 메뉴를 찾기만 하고 누르지 않으며, 테스트 모드는 앞의 몇 개만 처리합니다. 삭제하기 전에 대상 목록을 JSON과 CSV 파일로 저장해 둘 수도 있습니다.
- 목록 전체를 JSON이나 CSV 파일로 내보냅니다.
- 원하면 본인의 YouTube Data API 키를 넣어 영상 종류, 게시일, 조회수를 보고, 이 정보로 정렬하고 묶고 걸러 볼 수 있습니다.

관리 화면은 YouTube 옆의 Chrome 사이드 패널이나 새 탭에서 열립니다. 영어와 한국어를 지원합니다.

삭제 방식
영상은 목록 순서대로 하나씩, 최소 1초 간격을 두고 삭제합니다. 영상이 목록에서 사라졌는지 확인한 뒤에 다음으로 넘어가고, YouTube 화면이 예상과 다르게 동작하면 스스로 멈춥니다. '나중에 볼 동영상'과 본인의 재생목록에서만 삭제할 수 있습니다.

개인정보
- 스캔한 목록과 설정처럼 yt-easy가 보관하는 데이터는 모두 사용자의 Chrome 프로필 안에만 저장됩니다. yt-easy 서버는 없고, 사용 통계도 수집하지 않습니다.
- YouTube와는 사용자가 스캔하거나 정리하려고 고른 목록에 대해서만, 재생목록 페이지가 보내는 것과 같은 요청으로 통신합니다.
- YouTube Data API 키를 넣으면 영상 정보를 조회하려고 목록에 있는 영상의 ID를 YouTube Data API로 보냅니다. 키를 넣고 접근을 허용하기 전에는 API로 아무것도 보내지 않습니다.
개인정보 처리방침: https://github.com/jooy2/yt-easy/blob/main/PRIVACY.md

yt-easy는 MIT 라이선스로 공개된 오픈 소스입니다: https://github.com/jooy2/yt-easy
yt-easy는 YouTube 및 Google과 제휴하거나 보증을 받은 제품이 아닙니다.
```

### Category and language

- Category: the tools category under Productivity, the closest match for a tool that organizes lists. Pick the exact entry from the dashboard's list.
- Language: English. Add Korean with the description above.

### Graphic assets

Paths are from the repository root. The store icon is the extension's own icon, so it lives in `icons/`, not in this folder.

| Field              | File                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Store icon         | `icons/icon-128.png`                                                                              |
| Screenshots        | `.github/resources/store/01-channels.png` to `.github/resources/store/05-playlists.png`, in order |
| Small promo tile   | `.github/resources/store/promo-small.png`                                                         |
| Marquee promo tile | `.github/resources/store/promo-marquee.png` (optional)                                            |

The screenshots and promo images are regenerated with `npm run screenshots`.

### Additional fields

- Homepage URL: `https://github.com/jooy2/yt-easy`
- Support URL: `https://github.com/jooy2/yt-easy/issues`
- Mature content: no.

## Privacy practices tab

### Single purpose

```text
yt-easy manages the videos in the signed-in user's YouTube Watch later list and in the playlists the user chooses: it scans a chosen list, lets the user sort, group, filter, and export it, and removes the videos the user selects from that list.
```

### Permission justifications

`storage`:

```text
Keeps the scanned lists, the settings, and the video details the user looked up (category, publish date, view count) in chrome.storage.local on the user's computer, so the manager can show a list again without scanning it and remember its settings. Nothing is synced or sent anywhere.
```

`sidePanel`:

```text
Shows the manager in Chrome's side panel when the user clicks the toolbar icon, so the list sits next to the YouTube tab it manages.
```

`downloads`:

```text
Saves the files the user asks for: an export of the list, and an optional backup of the videos about to be removed, as JSON and CSV files in a yt-easy folder in Downloads. Before a removal starts, the extension checks that both backup files finished downloading.
```

Host permissions, `https://www.youtube.com/*` and the optional `https://www.googleapis.com/*`:

```text
www.youtube.com: the content script runs only on YouTube. It reads the playlist page of the list the user chose to scan (Watch later, or a playlist whose address the user entered), loads the rest of that list with the same request the page sends while scrolling, and, when the user starts a removal, opens each selected video's menu on that page and chooses its remove entry. The manager opens that list's tab and the videos the user opens.

www.googleapis.com (optional): requested only when the user saves their own YouTube Data API key in the settings, and removed when the key is removed. Used for videos.list, with the IDs of the videos in the user's list, and videoCategories.list, to show each video's category, publish date, and view count.
```

### Remote code

Choose "No, I am not using remote code." All scripts ship in the package: the manager is bundled at build time, and the content scripts are plain files. The YouTube pages and the Data API return data, which is never run as code.

### Data usage

Check these two:

- **Website content**: the titles, channel names, video IDs, lengths, and watch progress read from the playlist page the user chose. They are stored only on the user's computer. The video IDs are sent to the YouTube Data API only when the user adds their own key.
- **Authentication information**: to load a long list, the content script reads the YouTube sign-in cookie in the YouTube tab to compute the signature header that YouTube's own page sends with the same request. Only the signature, a hash computed from the cookie, goes to YouTube; the cookie value itself is never stored or sent. It is checked so that this use is disclosed, not because credentials are collected.

Leave these unchecked: personally identifiable information, health information, financial and payment information, personal communications, location, web history, and user activity. The extension does not record which pages the user visits, and it reads only the list the user chooses. It clicks the page's menus on the user's behalf but does not monitor the user's own clicks, scrolling, or typing.

Check all three certifications. yt-easy does not sell or transfer user data to third parties outside the approved uses, does not use or transfer it for purposes unrelated to its single purpose, and does not use or transfer it to determine creditworthiness or for lending.

### Privacy policy URL

```text
https://github.com/jooy2/yt-easy/blob/main/PRIVACY.md
```

The link works once `PRIVACY.md` is on the `main` branch of the public repository.

## Distribution tab

- Payments: free.
- Visibility: public. Choose unlisted to share it by link before it shows in search.
- Regions: all regions.

## Test instructions tab

The field takes at most 500 characters; this text is 488.

```text
Use any YouTube account with a few videos in Watch later.
1. Sign in to YouTube and click the toolbar icon to open the side panel.
2. Click "Start scan".
3. Select videos, click "Remove selected", turn on "Dry run", and click "Start checking". It finds each remove entry without clicking it.
Signed out, scan a public playlist with "Add a playlist…": https://www.youtube.com/playlist?list=PLjxrf2q8roU23XGwz3Km7sQZFTdB996iG
Category and view count need a YouTube Data API key in Settings.
```
