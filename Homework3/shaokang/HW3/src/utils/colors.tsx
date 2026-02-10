// src/utils/colors.ts
export const ALBUM_TYPE_COLORS: Record<string, string> = {
  album: "#4e79a7",        // Tableau Blue
  single: "#f28e2b",       // Tableau Orange
  compilation: "#e15759",  // Tableau Red
  unknown: "#9aa0a6",      // Gray
};

export function albumTypeColor(t?: string) {
  const key = (t ?? "unknown").toLowerCase();
  return ALBUM_TYPE_COLORS[key] ?? ALBUM_TYPE_COLORS.unknown;
}
