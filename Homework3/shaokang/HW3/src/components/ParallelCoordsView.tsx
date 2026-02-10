import * as d3 from "d3";
import { useMemo } from "react";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { TrackRow, topKGenres } from "../utils/preprocess";
import { albumTypeColor } from "../utils/colors";

type Props = {
  data: TrackRow[];
  title?: string;
  selectedYear?: number | null;
  selectedGenre?: string | null;
  selectedTrackId?: string | null;
};

export default function ParallelCoordsView({
  data,
  title,
  selectedYear = null,
  selectedGenre = null,
  selectedTrackId = null,
}: Props) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  const sample = useMemo(() => {
    let filtered = data.filter((d) => d.followers_log != null && d.duration_min != null);
    if (selectedYear != null) filtered = filtered.filter((d) => d.release_year === selectedYear);
    if (selectedGenre != null) {
      const top = topKGenres(filtered, 10);
      filtered = filtered.filter((d) => {
        const g = d.genre_top ?? "Unknown";
        const mapped = top.has(g) ? g : "Other";
        return mapped === selectedGenre;
      });
    }
    return [...filtered]
      .sort((a, b) => (b.track_popularity ?? 0) - (a.track_popularity ?? 0))
      .slice(0, 200);
  }, [data, selectedYear, selectedGenre]);

  const dims = ["track_popularity", "artist_popularity", "followers_log", "duration_min", "album_total_tracks"] as const;

  const width = size.width;
  const height = size.height;

  const margin = { top: 36, right: 18, bottom: 28, left: 42 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const x = d3.scalePoint<string>().domain(dims as unknown as string[]).range([0, innerW]).padding(0.4);

  const yScales = useMemo(() => {
    const m: Record<string, d3.ScaleLinear<number, number>> = {};
    for (const dim of dims) {
      const ext = d3.extent(sample, (d: any) => Number(d[dim]));
      const domain: [number, number] = ext[0] == null || ext[1] == null ? [0, 1] : [ext[0], ext[1]];
      m[dim] = d3.scaleLinear().domain(domain[0] === domain[1] ? [domain[0] - 1, domain[1] + 1] : domain).nice().range([innerH, 0]);
    }
    return m;
  }, [sample, innerH]);

  const albumTypes = useMemo(() => Array.from(new Set(sample.map((d) => d.album_type ?? "unknown"))), [sample]);
  const color = d3.scaleOrdinal<string, string>(d3.schemeTableau10).domain(albumTypes);

  const line = d3
    .line<[number, number]>()
    .x((p) => p[0])
    .y((p) => p[1]);

  const pathFor = (d: TrackRow) => {
    const pts: [number, number][] = [];
    for (const dim of dims) {
      const xv = x(dim) ?? 0;
      const yv = yScales[dim](Number((d as any)[dim]));
      pts.push([xv, yv]);
    }
    return line(pts) ?? "";
  };

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <svg width={width} height={height}>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* lines (linked highlighting from Scatter hover) */}
          {sample.map((d) => {
            const isSel = selectedTrackId != null && d.track_id === selectedTrackId;
            const opacity = selectedTrackId ? (isSel ? 0.85 : 0.06) : 0.22;
            const strokeWidth = isSel ? 2 : 1;
            return (
              <path
                key={d.track_id}
                d={pathFor(d)}
                fill="none"
                stroke={albumTypeColor(d.album_type)}
                strokeWidth={strokeWidth}
                opacity={opacity}
                style={{ transition: "opacity 0.35s ease" }}
              />
            );
          })}

          {/* axes */}
          {(dims as unknown as string[]).map((dim) => (
            <g key={dim} transform={`translate(${x(dim) ?? 0},0)`}>
              <line y1={0} y2={innerH} stroke="#ddd" />
              {/* ticks */}
              {yScales[dim].ticks(4).map((t) => (
                <g key={t} transform={`translate(0,${yScales[dim](t)})`}>
                  <line x1={-4} x2={4} stroke="#999" />
                  <text x={-6} y={0} fontSize={7} textAnchor="end" dominantBaseline="middle">
                    {Number.isFinite(t) ? t.toFixed(1) : t}
                  </text>
                </g>
              ))}
              <text y={innerH + 10} fontSize={8} textAnchor="middle" transform={`rotate(-20, 0, ${innerH + 18})`}>
                {dim}
              </text>
            </g>
          ))}

        {/* legend (percent-based) */}
        {(() => {
        // percent position within inner plot
        const lx = innerW * 0.72; // 72% from left
        const ly = - innerH * 0.20; // 5% from top

        const items = albumTypes.slice(0, 6);
        const rowH = 14;

        return (
            <g transform={`translate(${lx}, ${ly})`}>
            {/* background */}

            <text x={0} y={0} fontSize={8} fontWeight={600}>
                album_type
            </text>

            {items.map((t, i) => (
                <g key={t} transform={`translate(0, ${12 + i * rowH})`}>
                <rect x={0} y={-5} width={8} height={8} fill={color(t)} />
                <text x={14} y={0} fontSize={8} dominantBaseline="middle">
                    {t}
                </text>
                </g>
            ))}
            </g>
        );
        })()}

        </g>
      </svg>
    </div>
  );
}
