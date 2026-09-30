# Privacy Policy

Last updated: September 30, 2026

This policy describes how the yt-easy Chrome extension handles data. yt-easy helps you sort out your YouTube Watch later list and your playlists: it scans a list you choose, lets you sort, group, filter, and export it, and removes the videos you select.

yt-easy has no server of its own. It does not collect analytics, does not log anything remotely, and does not sell or share your data. yt-easy is not affiliated with or endorsed by YouTube or Google.

## What the extension reads

yt-easy reads data only from the list you choose to scan: Watch later, or a playlist whose address you entered. From that list's page on `www.youtube.com`, it reads:

- The title of the playlist, and the label of the menu entry that removes a video from it.
- For each video: its ID, title, channel name, channel ID, length, position in the list, and how much of it you have watched, as YouTube shows it with the red bar under the thumbnail.

To load a long list, yt-easy sends the same request the playlist page sends while you scroll. YouTube expects that request to carry a signature made from your sign-in cookie, so the extension reads that cookie in the YouTube tab only to compute the signature, as the page itself does. Only the signature, a hash computed from the cookie, is sent, and only to YouTube. The cookie value itself is never stored, never passed to the rest of the extension, and never sent by the extension.

When you remove videos, yt-easy opens each selected video's menu on the playlist page and chooses its remove entry, then checks that the video is gone. It reads nothing else from the page.

yt-easy does not read your browsing history, your YouTube watch history, or any page other than the YouTube pages described here. When you open a video from the manager, it checks whether the current tab is on `www.youtube.com` to decide whether to reuse that tab; it cannot see the address of a tab on any other site.

## What the extension stores

Everything yt-easy keeps is stored with `chrome.storage.local`, in your Chrome profile on your computer. It is not synced to other devices and never sent to the developer. The stored data is:

- The scanned lists, as described above. Up to six lists with 20,000 videos in all are kept, and older lists make room for newer ones.
- Your settings, including your YouTube Data API key if you enter one. The key is stored in plain text, like any other extension setting.
- The category, publish date, and view count of each video, if you look them up with the YouTube Data API, and the names of the categories with the language they came in.
- How you last sorted and filtered the list.

Export and backup files are saved only when you ask for them, to the `yt-easy` folder in your Downloads folder.

## What the extension sends, and to whom

yt-easy connects to three services, all run by Google:

- **YouTube (`www.youtube.com`)**, for the list you chose: the playlist page and the requests that load the rest of it, sent from the YouTube tab with that tab's own cookies, the same requests the page itself makes. Removing a video is a click on the page.
- **YouTube's image server (`i.ytimg.com`)**, for the thumbnails of the videos in the list, as YouTube itself shows them.
- **The YouTube Data API (`www.googleapis.com`)**, only if you enter your own API key in the settings and allow access to that site. To look up the category, publish date, and view count of videos, yt-easy sends the IDs of the videos in your list, 50 at a time, with your key. To get the names of the categories, it sends only the language and region the names should come in. When Chrome's language changes, the category names are asked for again the next time the manager opens.

No data is sent to anyone else.

## YouTube API Services

The optional lookup of categories, publish dates, and view counts uses YouTube API Services. By using that feature, you agree to be bound by the [YouTube Terms of Service](https://www.youtube.com/t/terms). Google's handling of the data it receives is described in the [Google Privacy Policy](https://www.google.com/policies/privacy).

## Your choices

- Leave the API key empty and nothing is sent to the YouTube Data API. Saving the settings with an empty key deletes the stored key and removes the extension's access to `www.googleapis.com`.
- **Remove this list from history** in the list menu deletes a scanned playlist from the extension's storage. It changes nothing on YouTube.
- Removing the extension from Chrome deletes everything it stored.

## Changes to this policy

This policy is kept in the yt-easy repository at <https://github.com/jooy2/yt-easy/blob/main/PRIVACY.md>, and its history shows every change. If a new version of yt-easy handles data differently, this policy is updated first, and the extension tells you about the change before it takes effect.

## Contact

For questions about this policy, open an issue at <https://github.com/jooy2/yt-easy/issues> or write through <https://cdget.com/contact>.
