import * as d3 from "d3";
import { useMemo } from "react";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { TrackRow } from "../utils/preprocess";
import { albumTypeColor, ALBUM_TYPE_COLORS } from "../utils/colors";

type Props = {
  data: TrackRow[];
  title?: string;
};

export default function ScatterView({ data, title }: Props) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  const cleaned = useMemo(() => {
    return data
      .filter(
        (d) =>
          d.followers_log != null &&
          Number.isFinite(d.followers_log) &&
          d.track_popularity != null &&
          Number.isFinite(d.track_popularity)
      )
      .slice(0, 2000);
  }, [data]);

  const albumTypes = useMemo(() => {
    const s = new Set(cleaned.map((d) => d.album_type ?? "unknown"));
    return Array.from(s);
  }, [cleaned]);

  const width = size.width;
  const height = size.height;

  const margin = { top: 36, right: 18, bottom: 56, left: 62 };
  const innerW = Math.max(0, width - margin.left - margin.right);
  const innerH = Math.max(0, height - margin.top - margin.bottom);

  const x = d3
    .scaleLinear()
    .domain(d3.extent(cleaned, (d) => d.followers_log!) as [number, number])
    .nice()
    .range([0, innerW]);

  const y = d3.scaleLinear().domain([0, 100]).nice().range([innerH, 0]);

  const color = (t: string) => albumTypeColor(t);

  const symbol = (explicit: boolean) =>
    d3.symbol().type(explicit ? d3.symbolTriangle : d3.symbolCircle).size(36)();

  const r = d3
    .scaleSqrt()
    .domain(d3.extent(cleaned, (d) => d.duration_min ?? 0) as [number, number])
    .range([2.5, 6]);

  const xTicks = x.ticks(6);
  const yTicks = y.ticks(5);

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <svg width={width} height={height}>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {yTicks.map((t) => (
            <line key={t} x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="#eee" />
          ))}
          {xTicks.map((t) => (
            <line key={t} y1={0} y2={innerH} x1={x(t)} x2={x(t)} stroke="#f3f3f3" />
          ))}

          {/* points */}
          {cleaned.map((d, i) => (
            <g key={`${d.track_id ?? "noid"}-${i}`}
              transform={`translate(${x(d.followers_log!)},${y(d.track_popularity)})`}
              opacity={0.65}
            >
              <path
                d={symbol(!!d.explicit) ?? undefined}
                fill={color(d.album_type ?? "unknown")}
                stroke="white"
                strokeWidth={0.5}
                // transform={`scale(${(r(d.duration_min ?? 0) ?? 3) / 3})`}
              />
            </g>
          ))}

          <g transform={`translate(0,${innerH})`}>
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={16} fontSize={10} textAnchor="middle">
                {t.toFixed(1)}
              </text>
            ))}
            <text x={innerW / 2} y={40} fontSize={11} textAnchor="middle">
              Artist Followers (log10)
            </text>
          </g>

          <g>
            {yTicks.map((t) => (
              <text key={t} x={-8} y={y(t)} fontSize={10} textAnchor="end" dominantBaseline="middle">
                {t}
              </text>
            ))}
            <text
              x={-44}
              y={innerH / 2}
              fontSize={11}
              textAnchor="middle"
              transform={`rotate(-90, ${-44}, ${innerH / 2})`}
            >
              Track Popularity
            </text>
          </g>

          <g transform={`translate(20, 10)`}>
            <text x={0} y={0} fontSize={10} fontWeight={600}>
              album_type
            </text>
            {albumTypes.slice(0, 6).map((t, i) => (
              <g key={t} transform={`translate(0, ${12 + i * 14})`}>
                <rect x={0} y={-9} width={10} height={10} fill={color(t)} />
                <text x={14} y={0} fontSize={10} dominantBaseline="middle">
                  {t}
                </text>
              </g>
            ))}

            <g transform={`translate(0, ${12 + 6 * 14 + 10})`}>
              <text x={0} y={0} fontSize={10} fontWeight={600}>
                explicit
              </text>
              <g transform="translate(0, 14)">
                <path d={d3.symbol().type(d3.symbolCircle).size(36)() ?? undefined} fill="#666" />
                <text x={14} y={0} fontSize={10} dominantBaseline="middle">
                  false
                </text>
              </g>
              <g transform="translate(0, 28)">
                <path d={d3.symbol().type(d3.symbolTriangle).size(36)() ?? undefined} fill="#666" />
                <text x={14} y={0} fontSize={10} dominantBaseline="middle">
                  true
                </text>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
