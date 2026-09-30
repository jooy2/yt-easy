# Security Policy

## Reporting Security Issues

To report a security vulnerability, create an issue on GitHub on the "Open a draft security advisory" page on GitHub: https://github.com/jooy2/yt-easy/security/advisories/new

Also, send private instructions in advance through https://cdget.com/contact. Do not submit vulnerability-related content as a general issue.

## What the extension keeps and sends

A report is easier to judge against what the extension is meant to do:

- The scanned lists, the settings, and the video information looked up with the Data API (category, publish date, view count) are kept in `chrome.storage.local`, inside your Chrome profile. They never leave your computer.
- A YouTube Data API key, if you enter one, is kept there too, in plain text, like any other extension setting. It is sent only to `www.googleapis.com`, in the `X-Goog-Api-Key` header, together with the IDs of the videos being looked up.
- Requests to YouTube are the same requests a playlist page sends for the list you chose to scan, made from the YouTube tab with its own cookies. The content script reads the sign-in cookie in that tab only to compute the signature header the page itself sends; the cookie value is never stored or passed to the rest of the extension.
- Export and backup files are written to the `yt-easy` folder in your Downloads folder.

## Security compliance

Project maintainers are quickly addressing reported security vulnerabilities in the project and providing relevant patches.

We report these to the relevant users and handle the correspondence to prevent the issue from recurring.

## Security recommendations

We recommend that users of project sources use the latest version, which addresses possible security vulnerabilities.

If you use an API key, restrict it to the YouTube Data API v3 in the Google Cloud console, so a leaked key cannot be used for anything else.

## Contact

- Administrator: https://cdget.com/contact
