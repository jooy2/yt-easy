// Renders only the rows near the visible part of a long list, so a list of
// thousands of videos stays as fast as a list of fifty. Rows are keyed, and
// an element is reused while its key stays in range, so thumbnails do not
// reload on every scroll frame.
export const createVirtualList = ({ container, getHeight, getKey, createRow, updateRow, label, overscan = 8 }) => {
  const content = document.createElement('div');

  content.className = 'virtual-content';
  content.setAttribute('role', 'list');
  content.setAttribute('aria-label', label);
  container.replaceChildren(content);

  let rows = [];
  let offsets = new Float64Array(1);
  let mounted = new Map();
  let frame = 0;

  const computeOffsets = () => {
    offsets = new Float64Array(rows.length + 1);

    for (let index = 0; index < rows.length; index += 1) {
      offsets[index + 1] = offsets[index] + getHeight(rows[index]);
    }

    content.style.height = `${offsets[rows.length]}px`;
  };

  // Index of the row that contains the vertical position `y`.
  const indexAt = (y) => {
    let low = 0;
    let high = rows.length - 1;

    while (low < high) {
      const middle = Math.ceil((low + high) / 2);

      if (offsets[middle] <= y) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return low;
  };

  const getVisibleRange = () => {
    if (rows.length === 0) {
      return { start: 0, end: -1 };
    }

    const top = container.scrollTop;

    return {
      start: Math.max(0, indexAt(top) - overscan),
      end: Math.min(rows.length - 1, indexAt(top + container.clientHeight) + overscan),
    };
  };

  const render = () => {
    frame = 0;

    const { start, end } = getVisibleRange();
    const keys = new Set();

    for (let index = start; index <= end; index += 1) {
      keys.add(getKey(rows[index]));
    }

    // Remove rows that left the range first, so the rows that stay are never
    // moved, and a focused row keeps its focus while the list scrolls.
    for (const [key, element] of mounted) {
      if (!keys.has(key)) {
        element.remove();
        mounted.delete(key);
      }
    }

    let cursor = content.firstChild;

    for (let index = start; index <= end; index += 1) {
      const row = rows[index];
      const key = getKey(row);
      const element = mounted.get(key) ?? createRow(row);

      element.dataset.key = key;
      element.style.transform = `translateY(${offsets[index]}px)`;
      element.style.height = `${getHeight(row)}px`;
      element.setAttribute('aria-posinset', String(index + 1));
      element.setAttribute('aria-setsize', String(rows.length));
      updateRow(element, row);
      mounted.set(key, element);

      // Keep DOM order equal to visual order so Tab moves down the list.
      if (element === cursor) {
        cursor = cursor.nextSibling;
      } else {
        content.insertBefore(element, cursor);
      }
    }
  };

  const schedule = () => {
    if (!frame) {
      frame = requestAnimationFrame(render);
    }
  };

  container.addEventListener('scroll', schedule, { passive: true });
  new ResizeObserver(schedule).observe(container);

  return {
    setRows: (nextRows, { resetScroll = false } = {}) => {
      rows = nextRows;
      computeOffsets();

      if (resetScroll) {
        container.scrollTop = 0;
      }

      schedule();
    },
    // Updates the rows on screen, for example after the selection changed.
    refresh: schedule,
  };
};
