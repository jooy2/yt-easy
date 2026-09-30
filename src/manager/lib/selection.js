// Selection rules for the video list, kept apart from React so they can be
// tested on their own. A selection is a Set of video IDs.

export const toggleOne = (selected, videoId) => {
  const next = new Set(selected);

  if (next.has(videoId)) {
    next.delete(videoId);
  } else {
    next.add(videoId);
  }

  return next;
};

export const addAll = (selected, videoIds) => {
  const next = new Set(selected);

  for (const videoId of videoIds) {
    next.add(videoId);
  }

  return next;
};

export const removeAll = (selected, videoIds) => {
  const next = new Set(selected);

  for (const videoId of videoIds) {
    next.delete(videoId);
  }

  return next;
};

// 'all', 'some', or 'none' of `videoIds` are selected.
export const readCoverage = (selected, videoIds) => {
  let count = 0;

  for (const videoId of videoIds) {
    if (selected.has(videoId)) {
      count += 1;
    }
  }

  if (count === 0) {
    return 'none';
  }

  return count === videoIds.length ? 'all' : 'some';
};
