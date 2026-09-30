// Everything that depends on how YouTube builds its pages lives in this file:
// DOM selectors, the keys of the embedded page data, and the menu wording.
// When YouTube changes its markup and something stops working, start here.
//
// Where two selectors are listed, the first matches the markup YouTube serves
// today (lockup view models) and the second matches the older Polymer
// renderers, kept as a fallback.
(() => {
  const ns = (globalThis.ytEasy ??= {});

  // Watch later is the playlist `WL`; any other playlist has its own ID.
  ns.WATCH_LATER_LIST_ID = 'WL';
  ns.toPlaylistPath = (listId) => `/playlist?list=${encodeURIComponent(listId)}`;

  ns.SELECTORS = {
    // The page element that holds the playlist on screen. YouTube keeps
    // earlier pages in the DOM with `hidden` set, so those are excluded.
    playlistPage: 'ytd-browse[page-subtype="playlist"]:not([hidden])',

    // One video row of the playlist.
    item: 'yt-lockup-view-model, ytd-playlist-video-renderer',

    // The placeholder at the end of the list. YouTube loads the next page
    // when it scrolls into view.
    continuation: 'yt-continuation-item-view-model, ytd-continuation-item-renderer',

    // Parts of one row, used when the list is read from the DOM.
    itemLink: 'a[href*="/watch?v="]',
    itemTitle: 'a.ytLockupMetadataViewModelTitle, a#video-title',
    itemChannelLink: [
      '.ytContentMetadataViewModelMetadataRow a[href^="/@"]',
      '.ytContentMetadataViewModelMetadataRow a[href^="/channel/"]',
      'ytd-channel-name a',
    ].join(', '),
    itemDuration: [
      'badge-shape .ytBadgeShapeText',
      'ytd-thumbnail-overlay-time-status-renderer #text',
      '.badge-shape-wiz__text',
    ].join(', '),
    // The red bar under a thumbnail; its width is how much was watched.
    itemWatchedBar: [
      '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment',
      'ytd-thumbnail-overlay-resume-playback-renderer #progress',
    ].join(', '),

    // The "more actions" button of one row.
    itemMenuButton: [
      '.ytLockupMetadataViewModelMenuButton button',
      '#menu yt-icon-button button',
      '#menu button',
    ].join(', '),

    // The popup that the menu button opens, and the entries inside it.
    menuPopup: 'ytd-popup-container tp-yt-iron-dropdown',
    menuEntry: 'yt-list-item-view-model, ytd-menu-service-item-renderer',
    menuEntryTarget: 'button, a, [role="menuitem"], tp-yt-paper-item',
  };

  // Labels of the "Remove from Watch later" menu entry. The collector reads
  // the exact label from the page data, in the account's own UI language, and
  // passes it to the remover first; this list is the fallback. In another
  // playlist the entry names that playlist, so only the label from the page
  // data is used there.
  ns.REMOVE_MENU_LABELS = [
    '나중에 볼 동영상에서 삭제',
    'Remove from Watch later',
    'Remove from Watch Later',
  ];

  ns.PAGE_DATA = {
    // How the page HTML assigns its initial data.
    initialDataMarkers: ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '],
    configMarker: 'ytcfg.set({',

    // Keys of the entries in a playlist's item list.
    itemKeys: {
      lockup: 'lockupViewModel',
      legacy: 'playlistVideoRenderer',
    },
    continuationKeys: ['continuationItemViewModel', 'continuationItemRenderer'],
    // How far a video was watched, in percent, for the account.
    watchedBarKey: 'thumbnailOverlayProgressBarViewModel',
    legacyWatchedKey: 'thumbnailOverlayResumePlaybackRenderer',
    // Where the page data keeps the playlist title, and the message YouTube
    // shows in place of a list, such as for a playlist that does not exist.
    playlistMetadataKey: 'playlistMetadataRenderer',
    alertKeys: ['alertWithButtonRenderer', 'alertRenderer'],
    videoContentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    removeActionPrefix: 'ACTION_REMOVE_VIDEO',

    // Containers whose items are not part of the playlist, such as the
    // recommendation shelf YouTube appends below a short list.
    skipKeys: [
      'horizontalShelfViewModel',
      'shelfRenderer',
      'richShelfRenderer',
      'reelShelfRenderer',
      'sidebar',
      'header',
      'topbar',
      'microformat',
      'frameworkUpdates',
    ],

    // The request the page itself sends to load the next part of the list.
    browsePath: '/youtubei/v1/browse',

    // Cookies used to sign that request, and the scheme each one feeds.
    authCookies: [
      { cookies: ['SAPISID', '__Secure-3PAPISID'], scheme: 'SAPISIDHASH' },
      { cookies: ['__Secure-1PAPISID'], scheme: 'SAPISID1PHASH' },
      { cookies: ['__Secure-3PAPISID'], scheme: 'SAPISID3PHASH' },
    ],
  };
})();
