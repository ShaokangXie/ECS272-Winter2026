export type TrackRow = {
  track_id: string;
  track_name: string;
  track_number: number;
  track_popularity: number;
  explicit: boolean;
  artist_name: string;
  artist_popularity: number;
  artist_followers: number;
  artist_genres: string; // e.g. "['pop','dance pop']" or "[]"
  album_release_date: string; // "YYYY-MM-DD"
  album_total_tracks: number;
  album_type: "album" | "single" | "compilation" | string;
  track_duration_ms?: number;
  track_duration_min?: number;

  // derived:
  release_year?: number;
  followers_log?: number;
  duration_min?: number;
  genre_top?: string;
};

function toNumber(x: any, fallback = 0) {
  const v = Number(x);
  return Number.isFinite(v) ? v : fallback;
}

function toBool(x: any) {
  if (typeof x === "boolean") return x;
  if (typeof x === "string") return x.toLowerCase() === "true";
  return Boolean(x);
}

// Robust-ish parser for "['pop', 'dance pop']" (python list string) OR "[]"
export function parseGenresTop(genresStr: string): string {
  if (!genresStr) return "Unknown";
  const s = genresStr.trim();
  if (s === "[]" || s === "") return "Unknown";
  // remove [ ]
  const inner = s.replace(/^\[/, "").replace(/\]$/, "").trim();
  if (!inner) return "Unknown";
  // split by comma, strip quotes
  const parts = inner
    .split(",")
    .map((p) => p.trim().replace(/^['"]/, "").replace(/['"]$/, ""))
    .filter((p) => p.length > 0);

  return parts[0] ?? "Unknown";
}

export function preprocessTracks(rows: any[]): TrackRow[] {
  const currentYear = new Date().getFullYear();
  return rows.map((r) => {
    const yearRaw =
      typeof r.album_release_date === "string" && r.album_release_date.length >= 4
        ? Number(r.album_release_date.slice(0, 4))
        : NaN;

    const year =
      Number.isFinite(yearRaw) && yearRaw >= 1900 && yearRaw <= currentYear + 1
        ? yearRaw
        : undefined;

    const ms = r.track_duration_ms != null ? toNumber(r.track_duration_ms, NaN) : NaN;
    const minFromMs = Number.isFinite(ms) ? ms / 60000 : NaN;
    const minFromCol = r.track_duration_min != null ? toNumber(r.track_duration_min, NaN) : NaN;

    const followers = toNumber(r.artist_followers, 0);
    const followersLog = Math.log10(followers + 1);

    const genreTop = parseGenresTop(String(r.artist_genres ?? ""));

    return {
      ...r,
      track_number: toNumber(r.track_number, 0),
      track_popularity: toNumber(r.track_popularity, 0),
      explicit: toBool(r.explicit),
      artist_popularity: toNumber(r.artist_popularity, 0),
      artist_followers: followers,
      album_total_tracks: toNumber(r.album_total_tracks, 0),
      track_duration_ms: Number.isFinite(ms) ? ms : undefined,
      track_duration_min: Number.isFinite(minFromCol) ? minFromCol : undefined,

      release_year: year,
      followers_log: followersLog,
      duration_min: Number.isFinite(minFromCol) ? minFromCol : (Number.isFinite(minFromMs) ? minFromMs : undefined),
      genre_top: genreTop,
    };
  });
}

export function topKGenres(data: TrackRow[], k = 10): Set<string> {
  const counts = new Map<string, number>();
  for (const d of data) {
    const g = d.genre_top ?? "Unknown";
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return new Set(sorted.slice(0, k).map((x) => x[0]));
}
