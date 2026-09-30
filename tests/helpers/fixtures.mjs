// Synthetic page data shaped like the playlist data YouTube serves. The IDs,
// titles, and channels are invented.
export const REMOVE_LABEL = 'Remove from Watch later';

const removeCommand = (videoId) => ({
  innertubeCommand: {
    playlistEditEndpoint: {
      playlistId: 'WL',
      actions: [{ action: 'ACTION_REMOVE_VIDEO_BY_VIDEO_ID', removedVideoId: videoId }],
    },
  },
});

export const lockup = ({
  videoId,
  title = `Video ${videoId}`,
  channel = 'Sample Channel',
  channelId = 'UCaaaaaaaaaaaaaaaaaaaaaa',
  duration = '4:05',
  listId = 'WL',
  contentType = 'LOCKUP_CONTENT_TYPE_VIDEO',
  watched = null,
  segmented = false,
}) => ({
  lockupViewModel: {
    contentId: videoId,
    contentType,
    contentImage: {
      thumbnailViewModel: {
        image: {
          sources: [
            { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?size=small`, width: 168, height: 94 },
            { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg?size=large`, width: 336, height: 188 },
          ],
        },
        overlays: [
          {
            thumbnailBottomOverlayViewModel: {
              ...(watched == null
                ? {}
                : { progressBar: { thumbnailOverlayProgressBarViewModel: { startPercent: watched, enableSegmentView: segmented } } }),
              badges: [{ thumbnailBadgeViewModel: { text: duration } }],
            },
          },
          {
            // The hover button also carries a remove action, with a label
            // that is not the menu entry. It must not be picked up.
            thumbnailHoverOverlayToggleActionsViewModel: {
              buttons: [{
                toggleButtonViewModel: {
                  toggledButtonViewModel: {
                    buttonViewModel: { accessibilityText: 'Added', onTap: removeCommand(videoId) },
                  },
                },
              }],
            },
          },
        ],
      },
    },
    metadata: {
      lockupMetadataViewModel: {
        title: { content: title },
        metadata: {
          contentMetadataViewModel: {
            metadataRows: [
              {
                metadataParts: [{
                  text: {
                    content: channel,
                    commandRuns: [{ onTap: { innertubeCommand: { browseEndpoint: { browseId: channelId } } } }],
                  },
                }],
              },
              { metadataParts: [{ text: { content: '1.2K views' } }] },
            ],
          },
        },
        menuButton: {
          buttonViewModel: {
            onTap: {
              innertubeCommand: {
                showSheetCommand: {
                  panelLoadingStrategy: {
                    inlineContent: {
                      sheetViewModel: {
                        content: {
                          listViewModel: {
                            listItems: [
                              { listItemViewModel: { title: { content: 'Add to queue' } } },
                              {
                                listItemViewModel: {
                                  title: { content: REMOVE_LABEL },
                                  rendererContext: { commandContext: { onTap: removeCommand(videoId) } },
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    rendererContext: {
      commandContext: {
        onTap: { innertubeCommand: { watchEndpoint: { videoId, playlistId: listId, index: 0 } } },
      },
    },
  },
});

export const continuationEntry = (token) => ({
  continuationItemViewModel: {
    continuationCommand: {
      innertubeCommand: { continuationCommand: { token, request: 'CONTINUATION_REQUEST_TYPE_BROWSE' } },
    },
  },
});

export const initialData = (entries, extraSections = [], { title, alert } = {}) => ({
  ...(title ? { metadata: { playlistMetadataRenderer: { title } } } : {}),
  ...(alert ? { alerts: [{ alertWithButtonRenderer: { type: 'ERROR', text: { simpleText: alert } } }] } : {}),
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [{
        tabRenderer: {
          content: {
            sectionListRenderer: {
              contents: [{ itemSectionRenderer: { contents: entries } }, ...extraSections],
            },
          },
        },
      }],
    },
  },
  sidebar: { playlistSidebarRenderer: { items: [] } },
});

export const continuationResponse = (entries) => ({
  onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: entries } }],
});

export const videoId = (index) => `vid${String(index).padStart(8, '0')}`;

export const pageHtml = ({ data, config }) => [
  '<!doctype html><html><head>',
  `<script>ytcfg.set(${JSON.stringify({ CLIENT_CANARY_STATE: 'none' })});</script>`,
  `<script>ytcfg.set(${JSON.stringify(config)});</script>`,
  '</head><body>',
  `<script>var ytInitialData = ${JSON.stringify(data)};</script>`,
  '</body></html>',
].join('\n');
