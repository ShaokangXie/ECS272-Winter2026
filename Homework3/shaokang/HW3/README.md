# Homework 3 — Interactive Visualization Dashboard (D3 + React)

## Theme
This dashboard supports **exploratory analysis of Spotify tracks** using a **focus + context** design.  
Users can first locate interesting subsets in an overview (context) and then drill down into detailed views (focus) to understand relationships and individual track profiles.

---

## Dataset
The dashboard uses Spotify track data with attributes including:
- `release_year`, `genre_top`, `album_type`, `explicit`
- `track_popularity`, `artist_followers` (log10), `artist_popularity`
- `duration_min`, `album_total_tracks`, etc.

Records are filtered to valid numeric values before visualization.

---

## Views and Visual Encodings (Focus + Context)

### View 1 (Focus): Scatter Plot — Track Popularity vs. Artist Followers
**Purpose:** Explore the relationship between popularity and artist follower scale, and compare patterns across categories.

**Encodings:**
- **x-axis:** `artist_followers (log10)`
- **y-axis:** `track_popularity`
- **color:** `album_type` (album / single / compilation)
- **shape:** `explicit` (circle = false, triangle = true)

---

### View 2 (Context): Heatmap — Track Count by Year × Genre
**Purpose:** Provide an overview distribution to quickly identify dense/sparse regions and potential outliers.

**Encodings:**
- **x-axis:** `release_year`
- **y-axis:** `genre_top` (Top 10 + Other)
- **color intensity:** count of tracks in each (year, genre) cell

This view serves as the **context** view for drill-down.

---

### View 3 (Focus): Parallel Coordinates — Multivariate Track Profile
**Purpose:** Inspect the multi-attribute profile of tracks after filtering, supporting deeper analysis beyond 2D.

**Encodings:**
- Each polyline = one track across multiple normalized axes  
  (e.g., popularity, artist popularity, followers log, duration, album total tracks).

---

## Interactions (HW3 Requirements)

### Fundamental Interaction: Tooltip + Highlighting
- **Scatter plot hover:** shows tooltip (track title, artist, year, genre, popularity, followers, etc.).
- Hover also triggers **highlighting**: hovered mark is emphasized while others fade.
- The hovered track is **linked-highlighted** in the parallel coordinates view.

- **Heatmap hover:** shows tooltip (year, genre, count).

This supports **details-on-demand** without changing the viewport.

---

### Coordinated Filtering (Multiple Views)
- **Click a heatmap cell (year × genre)** to select a subset.
- The selection **filters both focus views**:
  - Scatter plot updates to show only tracks in the selected year/genre.
  - Parallel coordinates updates to show the multivariate profiles of the same subset.
- Clicking the same cell again clears the selection.

This creates a consistent drill-down flow:  
**Overview (context) → select subset → focus views update for detailed exploration.**

---

## Animated Transitions (HW3 Requirements)
Animated transitions are used to preserve users’ mental map during state changes:
- **Heatmap:** selection triggers opacity fade of non-selected cells and stroke emphasis for the selected cell (transition).
- **Scatter:** filtering triggers enter/update/exit transitions for points, and axis rescaling is animated.

These transitions help users visually track changes rather than experiencing abrupt jumps.

---

## Design Rationale (Why this Dashboard Supports Exploration)
The dashboard is designed around a natural exploration workflow:

1. **Start with context:** Use the heatmap to identify interesting (year, genre) regions  
   (dense counts, sparse areas, or unusual patterns over time).
2. **Drill down via coordinated filtering:** Clicking a cell narrows the dataset to a meaningful subset, preventing a “visualization dump”.
3. **Analyze relationships in focus:** The scatter plot reveals how popularity relates to artist follower scale within the chosen subset, while also comparing `album_type` and `explicit`.
4. **Inspect multivariate profiles:** Linked highlighting and parallel coordinates enable deeper inspection of individual tracks and comparison across multiple attributes.
5. **Animated transitions maintain semantic correspondence:** Marks represent the same underlying items across interactions, and transitions help users track what changed and why.

Overall, the design enables **overview → filter → detailed analysis → multivariate inspection** in an intuitive, user-friendly flow.

---

## How to Run
```bash
npm install
npm run dev
