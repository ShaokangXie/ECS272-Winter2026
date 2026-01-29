import * as d3 from "d3";
import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import HeatmapView from "./HeatmapView";
import ScatterView from "./ScatterView";
import ParallelCoordsView from "./ParallelCoordsView";
import { preprocessTracks, TrackRow } from "../utils/preprocess";

function Card({
  title,
  caption,
  children,
}: {
  title: string;
  caption: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        height: "100%",
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      </Box>

      {/* Plot area (IMPORTANT: prevent resize feedback loops) */}
      <Box
        sx={{
          flex: "1 1 0px",
          minHeight: 0,
          px: 1.5,
          pb: 1,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Children fill the plot box without affecting its size */}
        <Box sx={{ position: "absolute", inset: 0 }}>
          {children}
        </Box>
      </Box>

      {/* Caption */}
      <Box sx={{ px: 2, py: 1, borderTop: "1px solid", borderColor: "divider" }}>
        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.35 }}>
          {caption}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<TrackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [a, b] = await Promise.all([
        d3.csv("/data/track_data_final.csv"),
        d3.csv("/data/spotify_data_clean.csv"),
      ]);

      const A = preprocessTracks(a);
      const B = preprocessTracks(b);

      // merge by track_id, prefer A
      const map = new Map<string, TrackRow>();
      for (const r of B) map.set(r.track_id, r);
      for (const r of A) map.set(r.track_id, { ...map.get(r.track_id), ...r });

      setData(Array.from(map.values()));
      setLoading(false);
    }
    load();
  }, []);

  const subtitle = useMemo(() => {
    if (loading) return "Loading…";
    return `Loaded ${data.length.toLocaleString()} tracks`;
  }, [loading, data.length]);

  if (loading) {
    return (
      <Box
        id="main-container"
        sx={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          boxSizing: "border-box",
          p: 2,
        }}
      >
        {subtitle}
      </Box>
    );
  }

  return (
    <Box
      id="main-container"
      sx={{
        height: "100vh",          
        overflow: "hidden",       
        boxSizing: "border-box",
        p: 2,
      }}
    >
      <Box
        sx={{
          height: "100%",
          minHeight: 0,
          display: "grid",
          gap: 2,
          // Desktop: 2 columns. Left spans 2 rows.
          gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
          gridTemplateRows: { xs: "1fr 1fr 1fr", md: "1fr 1fr" },
        }}
      >
        {/* Left: Focus scatter (span 2 rows on desktop) */}
        <Box sx={{ minHeight: 0, gridColumn: { xs: "1", md: "1" }, gridRow: { xs: "1", md: "1 / span 2" } }}>
          <Card
            title="Focus: Track Popularity vs. Artist Followers"
            caption={
              <>
                Each mark is a track. x = artist followers (log10), y = track popularity; color encodes
                album type and shape encodes whether the track is explicit.
              </>
            }
          >
            <ScatterView data={data} />
          </Card>
        </Box>

        {/* Right-top: Overview heatmap */}
        <Box sx={{ minHeight: 0, gridColumn: { xs: "1", md: "2" }, gridRow: { xs: "2", md: "1" } }}>
          <Card
            title="Overview: Tracks by Year and Genre (Count)"
            caption={
              <>
                Context view: number of tracks in each release year × primary genre (Top 10 + Other).
                Darker cells indicate more tracks.
              </>
            }
          >
            <HeatmapView data={data} />
          </Card>
        </Box>

        {/* Right-bottom: Advanced parallel coords */}
        <Box sx={{ minHeight: 0, gridColumn: { xs: "1", md: "2" }, gridRow: { xs: "3", md: "2" } }}>
          <Card
            title="Advanced: Multivariate Profile (Parallel Coordinates)"
            caption={
              <>
                Each polyline is a track across multiple attributes (popularity, followers, duration,
                etc.). Color compares multivariate profiles of album vs. single tracks.
              </>
            }
          >
            <ParallelCoordsView data={data} />
          </Card>
        </Box>
      </Box>
    </Box>
  );
}
