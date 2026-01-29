import * as d3 from "d3";
import { useMemo } from "react";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { TrackRow } from "../utils/preprocess";

type Props = {
  data: TrackRow[];
  title?: string;
};

export default function HeatmapView({ data, title }: Props) {
  const { ref, size } = useResizeObserver<HTMLDivElement>();

  const { years, genres, matrix, maxVal } = useMemo(() => {
    const filtered = data.filter((d) => d.release_year != null && d.genre_top != null);
    const years = Array.from(new Set(filtered.map((d) => d.release_year!))).sort((a, b) => a - b);

    // top 10 + Other
    const counts = d3.rollups(
      filtered,
      (v) => v.length,
      (d) => d.genre_top!
    );
    counts.sort((a, b) => d3.descending(a[1], b[1]));
    const top = new Set(counts.slice(0, 10).map((x) => x[0]));

    const genres = Array.from(
      new Set(filtered.map((d) => (top.has(d.genre_top!) ? d.genre_top! : "Other")))
    ).sort((a, b) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });

    // matrix: Map "genre|year" -> count
    const matrix = new Map<string, number>();
    for (const d of filtered) {
      const g = top.has(d.genre_top!) ? d.genre_top! : "Other";
      const y = d.release_year!;
      const key = `${g}|${y}`;
      matrix.set(key, (matrix.get(key) ?? 0) + 1);
    }

    const maxVal = d3.max([...matrix.values()]) ?? 1;

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

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      <svg width={width} height={height}>

        {/* plot */}
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* cells */}
          {genres.map((g) =>
            years.map((yr) => {
              const v = matrix.get(`${g}|${yr}`) ?? 0;
              return (
                <rect
                  key={`${g}-${yr}`}
                  x={x(yr)}
                  y={y(g)}
                  width={x.bandwidth()}
                  height={y.bandwidth()}
                  fill={color(v)}
                  stroke="white"
                />
              );
            })
          )}

          {/* x axis labels (simple) */}
          <g transform={`translate(0,${innerH})`}>
            {yearTicks.map((yr) => (
              <text
                key={yr}
                x={(x(yr) ?? 0) + x.bandwidth() / 2}
                y={16}
                fontSize={10}
                textAnchor="middle"
              >
                {yr}
              </text>
            ))}
            <text x={innerW / 2} y={40} fontSize={11} textAnchor="middle">
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
                fontSize={10}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {g}
              </text>
            ))}
            <text
              x={-70}
              y={innerH / 2}
              fontSize={11}
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
              return (
                <rect key={i} x={i * 3.2} y={6} width={3.2} height={8} fill={color(v)} />
              );
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
