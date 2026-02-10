import * as d3 from "d3";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { TrackRow, topKGenres } from "../utils/preprocess";
import { albumTypeColor } from "../utils/colors";

type TooltipState = {
  x: number;
  y: number;
  title: string;
  body: string[];
} | null;

type Props = {
  data: TrackRow[];
  selectedYear?: number | null;
  selectedGenre?: string | null;
  selectedTrackId?: string | null;
  /** Called when hovering a point (for linked highlighting). */
  onHoverTrackId?: (id: string | null) => void;
};

/**
 * HW3 updates:
 * - Tooltip + highlighting on hover.
 * - Coordinated filtering from the Heatmap selection.
 * - Animated transitions for filtering (enter/update/exit) using d3.transition.
 *
 * Tooltip fix:
 * - Auto flip/clamp tooltip position so it never goes outside the scatter container
 *   (avoids being clipped by parent overflow hidden).
 */
export default function ScatterView({
  data,
  selectedYear = null,
  selectedGenre = null,
  selectedTrackId = null,
  onHoverTrackId,
}: Props) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState>(null);

  // NEW: measure tooltip so we can keep it within bounds
  const tipRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    let rows = data.filter(
      (d) =>
        d.followers_log != null &&
        Number.isFinite(d.followers_log) &&
        d.track_popularity != null &&
        Number.isFinite(d.track_popularity)
    );

    if (selectedYear != null) {
      rows = rows.filter((d) => d.release_year === selectedYear);
    }

    if (selectedGenre != null) {
      const top = topKGenres(rows, 10);
      rows = rows.filter((d) => {
        const g = d.genre_top ?? "Unknown";
        const mapped = top.has(g) ? g : "Other";
        return mapped === selectedGenre;
      });
    }

    // Limit for perf.
    return rows.slice(0, 2500);
  }, [data, selectedYear, selectedGenre]);

  // NEW: compute tooltip position within container (flip + clamp)
  function computeTipPos(
    event: PointerEvent,
    container: DOMRect,
    tipW: number,
    tipH: number
  ) {
    const pad = 12;

    // default: place at cursor bottom-right
    let x = event.clientX - container.left + pad;
    let y = event.clientY - container.top + pad;

    // flip horizontally if overflow right
    if (x + tipW + pad > container.width) {
      x = event.clientX - container.left - tipW - pad;
    }
    // flip vertically if overflow bottom
    if (y + tipH + pad > container.height) {
      y = event.clientY - container.top - tipH - pad;
    }

    // clamp to container bounds
    x = Math.max(pad, Math.min(x, container.width - tipW - pad));
    y = Math.max(pad, Math.min(y, container.height - tipH - pad));

    return { x, y };
  }

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const width = size.width;
    const height = size.height;
    if (!width || !height) return;

    const margin = { top: 28, right: 18, bottom: 52, left: 62 };
    const innerW = Math.max(0, width - margin.left - margin.right);
    const innerH = Math.max(0, height - margin.top - margin.bottom);

    // Scales
    const extent = d3.extent(filtered, (d) => d.followers_log!);
    const xDomain: [number, number] =
      extent[0] == null || extent[1] == null ? [0, 1] : [extent[0], extent[1]];
    const x = d3
      .scaleLinear()
      .domain(xDomain[0] === xDomain[1] ? [xDomain[0] - 1, xDomain[1] + 1] : xDomain)
      .nice()
      .range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 100]).nice().range([innerH, 0]);

    const xAxis = d3.axisBottom(x).ticks(6);
    const yAxis = d3.axisLeft(y).ticks(5);

    const symbolFor = (explicit: boolean) =>
      d3.symbol().type(explicit ? d3.symbolTriangle : d3.symbolCircle).size(40)();

    const svg = d3.select(svgEl).attr("width", width).attr("height", height);

    const root = svg
      .selectAll<SVGGElement, null>("g.root")
      .data([null])
      .join("g")
      .attr("class", "root")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Grid ---
    const grid = root.selectAll<SVGGElement, null>("g.grid").data([null]).join("g").attr("class", "grid");
    grid
      .selectAll("line.h")
      .data(y.ticks(5))
      .join("line")
      .attr("class", "h")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", (t) => y(t))
      .attr("y2", (t) => y(t))
      .attr("stroke", "#eee");
    grid
      .selectAll("line.v")
      .data(x.ticks(6))
      .join("line")
      .attr("class", "v")
      .attr("y1", 0)
      .attr("y2", innerH)
      .attr("x1", (t) => x(t))
      .attr("x2", (t) => x(t))
      .attr("stroke", "#f3f3f3");

    // --- Axes (animated rescale when filtered changes) ---
    const xG = root
      .selectAll<SVGGElement, null>("g.x-axis")
      .data([null])
      .join("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${innerH})`);

    const yG = root.selectAll<SVGGElement, null>("g.y-axis").data([null]).join("g").attr("class", "y-axis");

    xG.transition().duration(420).ease(d3.easeCubicInOut).call(xAxis as any);
    yG.transition().duration(420).ease(d3.easeCubicInOut).call(yAxis as any);

    // Axis labels
    const labels = root.selectAll<SVGGElement, null>("g.labels").data([null]).join("g").attr("class", "labels");
    labels
      .selectAll("text.x-label")
      .data([null])
      .join("text")
      .attr("class", "x-label")
      .attr("x", innerW / 2)
      .attr("y", innerH + 42)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .text("Artist Followers (log10)");
    labels
      .selectAll("text.y-label")
      .data([null])
      .join("text")
      .attr("class", "y-label")
      .attr("x", -44)
      .attr("y", innerH / 2)
      .attr("text-anchor", "middle")
      .attr("font-size", 11)
      .attr("transform", `rotate(-90, ${-44}, ${innerH / 2})`)
      .text("Track Popularity");

    // --- Points (with enter/update/exit transitions) ---
    const pointsG = root.selectAll<SVGGElement, null>("g.points").data([null]).join("g").attr("class", "points");

    const hasHover = selectedTrackId != null && selectedTrackId !== "";
    const baseOpacity = 0.65;

    const join = pointsG
      .selectAll<SVGPathElement, TrackRow>("path.point")
      .data(filtered, (d: any) => d.track_id);

    // exit
    join
      .exit()
      .interrupt()
      .transition()
      .duration(260)
      .attr("opacity", 0)
      .remove();

    // enter
    const enter = join
      .enter()
      .append("path")
      .attr("class", "point")
      .attr("d", (d) => symbolFor(!!d.explicit) ?? "")
      .attr("fill", (d) => albumTypeColor(d.album_type ?? "unknown"))
      .attr("stroke", "white")
      .attr("stroke-width", 0.5)
      .attr("transform", (d) => `translate(${x(d.followers_log!)},${y(d.track_popularity)})`)
      .attr("opacity", 0)
      .style("cursor", "crosshair");

    // merge + update
    const merged = enter.merge(join as any);

    merged
      .interrupt()
      .transition()
      .duration(420)
      .ease(d3.easeCubicInOut)
      .attr("transform", (d) => `translate(${x(d.followers_log!)},${y(d.track_popularity)})`)
      .attr("fill", (d) => albumTypeColor(d.album_type ?? "unknown"))
      .attr("opacity", (d) => {
        if (!hasHover) return baseOpacity;
        return d.track_id === selectedTrackId ? 0.95 : 0.08;
      })
      .attr("stroke-width", (d) => (d.track_id === selectedTrackId ? 1.5 : 0.5));

    // Pointer interactions (tooltip + linked highlight)
    merged
      .on("pointerenter", (event: PointerEvent, d: TrackRow) => {
        onHoverTrackId?.(d.track_id);

        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();

        // measure tooltip size if possible; otherwise use a safe fallback
        const tipW = tipRef.current?.offsetWidth ?? 260;
        const tipH = tipRef.current?.offsetHeight ?? 150;

        const pos = computeTipPos(event, r, tipW, tipH);

        setTooltip({
          x: pos.x,
          y: pos.y,
          title: d.track_name ?? "(unknown track)",
          body: [
            `Artist: ${d.artist_name ?? "(unknown)"}`,
            `Popularity: ${d.track_popularity}`,
            `Followers(log10): ${d.followers_log?.toFixed(2)}`,
            `Year: ${d.release_year ?? "?"}`,
            `Genre: ${d.genre_top ?? "Unknown"}`,
          ],
        });
      })
      .on("pointermove", (event: PointerEvent) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();

        const tipW = tipRef.current?.offsetWidth ?? 260;
        const tipH = tipRef.current?.offsetHeight ?? 150;

        const pos = computeTipPos(event, r, tipW, tipH);

        setTooltip((prev: TooltipState) => (prev ? { ...prev, x: pos.x, y: pos.y } : prev));
      })
      .on("pointerleave", () => {
        onHoverTrackId?.(null);
        setTooltip(null);
      });

    // --- Legend ---
    const legend = root
      .selectAll<SVGGElement, null>("g.legend")
      .data([null])
      .join("g")
      .attr("class", "legend")
      .attr("transform", "translate(16, 8)");
    const albumTypes: string[] = Array.from(new Set(filtered.map((d) => d.album_type ?? "unknown"))).slice(0, 6);

    legend
      .selectAll("text.l-title")
      .data([null])
      .join("text")
      .attr("class", "l-title")
      .attr("x", 0)
      .attr("y", 0)
      .attr("font-size", 10)
      .attr("font-weight", 600)
      .text("album_type");

    const rows = legend.selectAll<SVGGElement, string>("g.l-row").data(albumTypes, (d: string) => d);
    const rowsEnter = rows.enter().append("g").attr("class", "l-row");
    rowsEnter.append("rect").attr("width", 10).attr("height", 10).attr("y", -9);
    rowsEnter.append("text").attr("x", 14).attr("y", 0).attr("font-size", 10).attr("dominant-baseline", "middle");
    const rowsMerged = rowsEnter.merge(rows);
    rowsMerged.attr("transform", (_d: string, i: number) => `translate(0, ${12 + i * 14})`);
    rowsMerged.select("rect").attr("fill", (d: string) => albumTypeColor(d));
    rowsMerged.select("text").text((d: string) => d);
    rows.exit().remove();


  const exp = legend
    .selectAll<SVGGElement, null>("g.exp")
    .data([null])
    .join("g")
    .attr("class", "exp")
    .attr("transform", `translate(0, ${12 + albumTypes.length * 14 + 14})`);

  exp.selectAll("text.exp-title")
    .data([null])
    .join("text")
    .attr("class", "exp-title")
    .attr("x", 0)
    .attr("y", 0)
    .attr("font-size", 10)
    .attr("font-weight", 600)
    .text("explicit");

  const expItems = [
    { label: "false", path: d3.symbol().type(d3.symbolCircle).size(60)() ?? "" },
    { label: "true",  path: d3.symbol().type(d3.symbolTriangle).size(70)() ?? "" },
  ];

  const expRows = exp
    .selectAll<SVGGElement, { label: string; path: string }>("g.e-row")
    .data(expItems, (d: any) => d.label);

    const expEnter = expRows.enter().append("g").attr("class", "e-row");

    // 关键：把 symbol 往右挪一点 + 加 stroke，让它清晰可见
    expEnter.append("path")
      .attr("transform", "translate(6, 0)")
      .attr("fill", "#666")
      .attr("stroke", "#333")
      .attr("stroke-width", 1);

    expEnter.append("text")
      .attr("x", 18)
      .attr("y", 0)
      .attr("font-size", 10)
      .attr("dominant-baseline", "middle");

    const expMerged = expEnter.merge(expRows as any);

    expMerged.attr("transform", (_d: any, i: number) => `translate(0, ${14 + i * 16})`);
    expMerged.select("path").attr("d", (d: any) => d.path);
    expMerged.select("text").text((d: any) => d.label);

    expRows.exit().remove();
  }, [filtered, size.width, size.height, selectedTrackId, onHoverTrackId]);

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
            maxWidth: 260,
            zIndex: 50,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{tooltip.title}</div>
          {tooltip.body.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      <svg ref={svgRef} width={size.width} height={size.height} />
    </div>
  );
}
