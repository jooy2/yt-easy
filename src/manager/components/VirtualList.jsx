import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const OVERSCAN = 6;

// Renders only the rows near the visible part of a long list, so thousands
// of videos scroll as smoothly as fifty. `renderRow` receives each row with
// its position and must return an absolutely positioned element keyed by the
// row. Changing `resetKey` scrolls back to the top.
export function VirtualList({ rows, getHeight, renderRow, resetKey, label, className }) {
  const containerRef = useRef(null);
  const frameRef = useRef(0);
  const [viewport, setViewport] = useState({ top: 0, height: 0 });

  const offsets = useMemo(() => {
    const values = new Float64Array(rows.length + 1);

    for (let index = 0; index < rows.length; index += 1) {
      values[index + 1] = values[index] + getHeight(rows[index]);
    }

    return values;
  }, [rows, getHeight]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    const measure = () => setViewport({ top: element.scrollTop, height: element.clientHeight });
    const observer = new ResizeObserver(measure);

    observer.observe(element);
    measure();

    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    containerRef.current.scrollTop = 0;
    setViewport((current) => ({ ...current, top: 0 }));
  }, [resetKey]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const handleScroll = () => {
    if (frameRef.current) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      const element = containerRef.current;

      frameRef.current = 0;

      if (element) {
        setViewport({ top: element.scrollTop, height: element.clientHeight });
      }
    });
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

  const visible = [];

  if (rows.length > 0) {
    const start = Math.max(0, indexAt(viewport.top) - OVERSCAN);
    const end = Math.min(rows.length - 1, indexAt(viewport.top + viewport.height) + OVERSCAN);

    for (let index = start; index <= end; index += 1) {
      visible.push(renderRow(rows[index], {
        index,
        top: offsets[index],
        height: getHeight(rows[index]),
        setSize: rows.length,
      }));
    }
  }

  return (
    <div ref={containerRef} className={className} onScroll={handleScroll}>
      <div className="virtual-content" role="list" aria-label={label} style={{ height: offsets[rows.length] }}>
        {visible}
      </div>
    </div>
  );
}
