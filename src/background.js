// Opens the manager in the side panel when the toolbar icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('yt-easy: could not set the side panel behavior.', error));
