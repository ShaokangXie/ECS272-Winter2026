import * as d3 from "d3";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { TrackRow } from "../utils/preprocess";

type TooltipState = {
  x: number;
  y: number;
  year: number;
  genre: string;
  count: number;
} | null;

type Props = {
  data: TrackRow[];
  /** Current selected year (from clicking a heatmap cell). */
  selectedYear?: number | null;
  /** Current selected genre (from clicking a heatmap cell). */
  selectedGenre?: string | null;
  /** Called when a heatmap cell is clicked. Use `(null, null)` to clear selection. */
  onSelect?: (year: number | null, genre: string | null) => void;
};

export default function HeatmapView({
  data,
  selectedYear = null,
  selectedGenre = null,
  onSelect,
}: Props) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>(null);

  // NEW: measure tooltip size
  const tipRef = useRef<HTMLDivElement | null>(null);

  const { years, genres, matrix, maxVal } = useMemo(() => {
    const filtered: TrackRow[] = data.filter((d) => d.release_year != null && d.genre_top != null);
    const years: number[] = Array.from(new Set(filtered.map((d) => d.release_year!))).sort((a, b) => a - b);

    // top 10 + Other (computed across all years)
    const counts = d3.rollups(
      filtered,
      (v: TrackRow[]) => v.length,
      (d: TrackRow) => d.genre_top!
    );
    counts.sort((a, b) => d3.descending(a[1], b[1]));
    const top: Set<string> = new Set(counts.slice(0, 10).map((x) => x[0]));

    const genres: string[] = Array.from(
      new Set(filtered.map((d) => (top.has(d.genre_top!) ? d.genre_top! : "Other")))
    ).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });

    // matrix: Map "genre|year" -> count
    const matrix: Map<string, number> = new Map();
    for (const d of filtered) {
      const g = top.has(d.genre_top!) ? d.genre_top! : "Other";
      const y = d.release_year!;
      const key = `${g}|${y}`;
      matrix.set(key, (matrix.get(key) ?? 0) + 1);
    }

    const maxVal: number = d3.max([...matrix.values()]) ?? 1;
    return { years, genres, matrix, maxVal };
  }, [data]);

  const width = size.width;
  const height = size.height;

  const margin = { top: 36, right: 16, bottom: 56, left: 90 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const x = d3.scaleBand<number>().domain(years).range([0, innerW]).padding(0.05);
  const y = d3.scaleBand<string>().domain(genres).range([0, innerH]).padding(0.05);
  const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal]);

  // axis ticks: if too many years, show every N
  const yearStep = years.length > 12 ? Math.ceil(years.length / 10) : 1;
  const yearTicks = years.filter((_, i) => i % yearStep === 0);

  // --- HW3: animated transition for filtering/highlighting ---
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const hasSel = selectedYear != null && selectedGenre != null;

    const sel = d3.select(svg).selectAll<SVGRectElement, unknown>("rect.heat-cell");
    sel.interrupt();

    sel
      .transition()
      .duration(420)
      .ease(d3.easeCubicInOut)
      .attr("opacity", (_d: unknown, i: number, nodes: SVGRectElement[]) => {
        if (!hasSel) return 1;
        const node = nodes[i];
        const yr = Number(node.getAttribute("data-year"));
        const g = String(node.getAttribute("data-genre"));
        return yr === selectedYear && g === selectedGenre ? 1 : 0.25;
      })
      .attr("stroke", (_d: unknown, i: number, nodes: SVGRectElement[]) => {
        if (!hasSel) return "white";
        const node = nodes[i];
        const yr = Number(node.getAttribute("data-year"));
        const g = String(node.getAttribute("data-genre"));
        return yr === selectedYear && g === selectedGenre ? "#ff7f0e" : "white";
      })
      .attr("stroke-width", (_d: unknown, i: number, nodes: SVGRectElement[]) => {
        if (!hasSel) return 1;
        const node = nodes[i];
        const yr = Number(node.getAttribute("data-year"));
        const g = String(node.getAttribute("data-genre"));
        return yr === selectedYear && g === selectedGenre ? 2.5 : 1;
      });
  }, [selectedYear, selectedGenre]);

  // NEW: compute tooltip position within container (flip + clamp)
  function computeTipPos(evt: React.PointerEvent, container: DOMRect, tipW: number, tipH: number) {
    const pad = 12;

    let x = evt.clientX - container.left + pad;
    let y = evt.clientY - container.top + pad;

    // flip if overflow right/bottom
    if (x + tipW + pad > container.width) x = evt.clientX - container.left - tipW - pad;
    if (y + tipH + pad > container.height) y = evt.clientY - container.top - tipH - pad;

    // clamp
    x = Math.max(pad, Math.min(x, container.width - tipW - pad));
    y = Math.max(pad, Math.min(y, container.height - tipH - pad));

    return { x, y };
  }

  // UPDATED: tooltip updates now keep tooltip within container bounds
  const updateTooltip = (evt: React.PointerEvent, year: number, genre: string, count: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    const tipW = tipRef.current?.offsetWidth ?? 240;
    const tipH = tipRef.current?.offsetHeight ?? 120;
    const pos = computeTipPos(evt, r, tipW, tipH);

    setTooltip({
      x: pos.x,
      y: pos.y,
      year,
      genre,
      count,
    });
  };

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", position: "relative" }}>
      {tooltip && (
        <div
          ref={tipRef}
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            pointerEvents: "none",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #ddd",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 12,
            lineHeight: 1.25,
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            maxWidth: 240,
            zIndex: 50,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{tooltip.genre}</div>
          <div>
            Year: <b>{tooltip.year}</b>
          </div>
          <div>
            Count: <b>{tooltip.count}</b>
          </div>
          <div style={{ marginTop: 4, color: "#666" }}>(Click to filter)</div>
        </div>
      )}

      <svg ref={svgRef} width={width} height={height}>
        {/* plot */}
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* cells */}
          {genres.map((g) =>
            years.map((yr) => {
              const v = matrix.get(`${g}|${yr}`) ?? 0;
              return (
                <rect
                  key={`${g}-${yr}`}
                  className="heat-cell"
                  data-year={yr}
                  data-genre={g}
                  x={x(yr)}
                  y={y(g)}
                  width={x.bandwidth()}
                  height={y.bandwidth()}
                  fill={color(v)}
                  stroke="white"
                  strokeWidth={1}
                  onPointerEnter={(evt) => updateTooltip(evt, yr, g, v)}
                  onPointerMove={(evt) => updateTooltip(evt, yr, g, v)}
                  onPointerLeave={() => setTooltip(null)}
                  onClick={() => onSelect?.(yr, g)}
                  style={{ cursor: "pointer" }}
                />
              );
            })
          )}

          {/* x axis labels */}
          <g transform={`translate(0,${innerH})`}>
            {yearTicks.map((yr) => (
              <text
                key={yr}
                x={(x(yr) ?? 0) + x.bandwidth() / 2}
                y={16}
                fontSize={7}
                transform={`rotate(-45, ${(x(yr) ?? 0) + x.bandwidth() / 2}, 16)`}
                textAnchor="middle"
              >
                {yr}
              </text>
            ))}
            <text x={innerW / 2} y={40} fontSize={9} textAnchor="middle">
              Release Year
            </text>
          </g>

          {/* y labels */}
          <g>
            {genres.map((g) => (
              <text
                key={g}
                x={-8}
                y={(y(g) ?? 0) + y.bandwidth() / 2}
                fontSize={6}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {g}
              </text>
            ))}
            <text
              x={-70}
              y={innerH / 2}
              fontSize={9}
              textAnchor="middle"
              transform={`rotate(-90, ${-70}, ${innerH / 2})`}
            >
              Primary Genre (Top 10 + Other)
            </text>
          </g>

          {/* legend (simple color bar) */}
          <g transform={`translate(${innerW - 140}, ${-26})`}>
            <text x={0} y={0} fontSize={10}>
              Count
            </text>
            {Array.from({ length: 40 }).map((_, i) => {
              const t = i / 39;
              const v = t * maxVal;
              return <rect key={i} x={i * 3.2} y={6} width={3.2} height={8} fill={color(v)} />;
            })}
            <text x={0} y={26} fontSize={9}>
              0
            </text>
            <text x={120} y={26} fontSize={9} textAnchor="end">
              {maxVal}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
