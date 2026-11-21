import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PriceDetail from './PriceDetail';

export interface HeatmapPair {
  symbol: string;
  name?: string;
  changePercent: number;
}

interface PriceChangeHeatmapProps {
  pairs: HeatmapPair[];
  onSelect?: (pair: HeatmapPair) => void;
}

const CELL_WIDTH = 96;
const CELL_HEIGHT = 44;
const GAP = 4;
const OVERSCAN = 4;

// Colour-blind-safe diverging palette (blue <-> orange, Okabe-Ito inspired).
// Negative moves trend blue, positive moves trend orange, neutral stays grey.
const NEGATIVE = [0, 114, 178]; // #0072B2
const NEUTRAL = [240, 240, 240]; // #F0F0F0
const POSITIVE = [230, 159, 0]; // #E69F00

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function cellColor(changePercent: number): string {
  const clamped = Math.max(-10, Math.min(10, changePercent));
  const t = Math.abs(clamped) / 10;
  const target = clamped < 0 ? NEGATIVE : POSITIVE;
  const r = lerp(NEUTRAL[0], target[0], t);
  const g = lerp(NEUTRAL[1], target[1], t);
  const b = lerp(NEUTRAL[2], target[2], t);
  return `rgb(${r}, ${g}, ${b})`;
}

function cellTextColor(changePercent: number): string {
  return Math.abs(changePercent) > 4 ? '#FFFFFF' : '#1A1A1A';
}

function formatChange(changePercent: number): string {
  const sign = changePercent > 0 ? '+' : '';
  return `${sign}${changePercent.toFixed(2)}%`;
}

const PriceChangeHeatmap: React.FC<PriceChangeHeatmapProps> = ({ pairs, onSelect }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const [columns, setColumns] = useState(8);
  const [selected, setSelected] = useState<HeatmapPair | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      setViewportHeight(el.clientHeight || 480);
      const width = el.clientWidth || CELL_WIDTH * 8;
      const nextColumns = Math.max(1, Math.floor((width + GAP) / (CELL_WIDTH + GAP)));
      setColumns(nextColumns);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const rowCount = Math.ceil(pairs.length / columns);
  const totalHeight = rowCount * (CELL_HEIGHT + GAP);

  const { startRow, endRow } = useMemo(() => {
    const first = Math.max(0, Math.floor(scrollTop / (CELL_HEIGHT + GAP)) - OVERSCAN);
    const visible = Math.ceil(viewportHeight / (CELL_HEIGHT + GAP)) + OVERSCAN * 2;
    return { startRow: first, endRow: Math.min(rowCount, first + visible) };
  }, [scrollTop, viewportHeight, rowCount]);

  const visiblePairs = useMemo(() => {
    const start = startRow * columns;
    const end = Math.min(pairs.length, endRow * columns);
    return pairs.slice(start, end).map((pair, index) => ({
      pair,
      index: start + index,
    }));
  }, [pairs, startRow, endRow, columns]);

  const handleSelect = useCallback(
    (pair: HeatmapPair) => {
      setSelected(pair);
      if (onSelect) onSelect(pair);
    },
    [onSelect]
  );

  const handleClose = useCallback(() => setSelected(null), []);

  return (
    <div className="price-change-heatmap">
      <div
        ref={containerRef}
        className="price-change-heatmap__viewport"
        style={{ position: 'relative', height: '100%', overflowY: 'auto' }}
        onScroll={handleScroll}
        role="grid"
        aria-label="Price change heatmap"
        aria-rowcount={rowCount}
        aria-colcount={columns}
      >
        <div style={{ position: 'relative', height: totalHeight }}>
          {visiblePairs.map(({ pair, index }) => {
            const row = Math.floor(index / columns);
            const col = index % columns;
            return (
              <button
                key={pair.symbol}
                type="button"
                role="gridcell"
                aria-label={`${pair.symbol} ${formatChange(pair.changePercent)}`}
                title={`${pair.name ? `${pair.name} (${pair.symbol})` : pair.symbol}: ${formatChange(
                  pair.changePercent
                )}`}
                onClick={() => handleSelect(pair)}
                style={{
                  position: 'absolute',
                  top: row * (CELL_HEIGHT + GAP),
                  left: col * (CELL_WIDTH + GAP),
                  width: CELL_WIDTH,
                  height: CELL_HEIGHT,
                  background: cellColor(pair.changePercent),
                  color: cellTextColor(pair.changePercent),
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  lineHeight: 1.2,
                  padding: 0,
                }}
              >
                <span style={{ fontWeight: 600 }}>{pair.symbol}</span>
                <span>{formatChange(pair.changePercent)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <table className="price-change-heatmap__table" aria-label="Price change table fallback">
        <caption>Price changes for all pairs</caption>
        <thead>
          <tr>
            <th scope="col">Pair</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair) => (
            <tr key={pair.symbol}>
              <th scope="row">
                <button type="button" onClick={() => handleSelect(pair)}>
                  {pair.symbol}
                </button>
              </th>
              <td>{formatChange(pair.changePercent)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && <PriceDetail symbol={selected.symbol} onClose={handleClose} />}
    </div>
  );
};

export default PriceChangeHeatmap;
