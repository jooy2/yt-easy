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

// Applies the anchor's state to every video between the anchor and the
// clicked one, the way Shift+click works in a mail client: after checking a
// row, Shift+click checks the rows up to the one clicked; after unchecking
// one, it unchecks them. `videoIds` is the list in the order shown. Without
// an anchor in that list, the click toggles the one video instead.
export const selectRange = ({ selected, videoIds, anchorId, targetId }) => {
  const anchorIndex = anchorId ? videoIds.indexOf(anchorId) : -1;
  const targetIndex = videoIds.indexOf(targetId);

  if (targetIndex === -1) {
    return selected;
  }

  if (anchorIndex === -1) {
    return toggleOne(selected, targetId);
  }

  const shouldSelect = selected.has(anchorId);
  const next = new Set(selected);

  for (let index = Math.min(anchorIndex, targetIndex); index <= Math.max(anchorIndex, targetIndex); index += 1) {
    if (shouldSelect) {
      next.add(videoIds[index]);
    } else {
      next.delete(videoIds[index]);
    }
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
