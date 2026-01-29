import * as d3 from "d3";
import { useMemo } from "react";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { TrackRow } from "../utils/preprocess";
import { albumTypeColor } from "../utils/colors";

type Props = {
  data: TrackRow[];
  title?: string;
};

export default function ParallelCoordsView({ data, title }: Props) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  const sample = useMemo(() => {
    const filtered = data.filter((d) => d.followers_log != null && d.duration_min != null);
    return [...filtered].sort((a, b) => (b.track_popularity ?? 0) - (a.track_popularity ?? 0)).slice(0, 200);
  }, [data]);

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
      const extent = d3.extent(sample, (d: any) => Number(d[dim])) as [number, number];
      m[dim] = d3.scaleLinear().domain(extent).nice().range([innerH, 0]);
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
          {/* lines */}
          {sample.map((d) => (
            <path
              key={d.track_id}
              d={pathFor(d)}
              fill="none"
              stroke={albumTypeColor(d.album_type)}
              strokeWidth={1}
              opacity={0.2}
            />
          ))}

          {/* axes */}
          {(dims as unknown as string[]).map((dim) => (
            <g key={dim} transform={`translate(${x(dim) ?? 0},0)`}>
              <line y1={0} y2={innerH} stroke="#ddd" />
              {/* ticks */}
              {yScales[dim].ticks(4).map((t) => (
                <g key={t} transform={`translate(0,${yScales[dim](t)})`}>
                  <line x1={-4} x2={4} stroke="#999" />
                  <text x={-6} y={0} fontSize={9} textAnchor="end" dominantBaseline="middle">
                    {Number.isFinite(t) ? t.toFixed(1) : t}
                  </text>
                </g>
              ))}
              <text y={innerH + 18} fontSize={10} textAnchor="middle">
                {dim}
              </text>
            </g>
          ))}

        {/* legend (percent-based) */}
        {(() => {
        // percent position within inner plot
        const lx = innerW * 0.75; // 72% from left
        const ly = - innerH * 0.05; // 5% from top

        const items = albumTypes.slice(0, 6);
        const rowH = 14;
        const pad = 8;
        const boxW = 150;
        const boxH = pad * 2 + 12 + items.length * rowH; // title + rows

        return (
            <g transform={`translate(${lx}, ${ly})`}>
            {/* background */}

            <text x={0} y={0} fontSize={10} fontWeight={600}>
                album_type
            </text>

            {items.map((t, i) => (
                <g key={t} transform={`translate(0, ${12 + i * rowH})`}>
                <rect x={0} y={-9} width={10} height={10} fill={color(t)} />
                <text x={14} y={0} fontSize={10} dominantBaseline="middle">
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
