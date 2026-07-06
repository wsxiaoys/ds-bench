# Three-View Brush Crossfilter Dashboard for Movies with Vega-Altair

## Background
Build an interactive 3-view crossfilter dashboard for the IMDb/Rotten Tomatoes movies dataset using Vega-Altair. A user drags a 2D brush over a scatter plot; the bar chart and histogram below update to show only the rows whose scatter-plot point falls inside the brush. The chart must be exported to a self-contained HTML file that renders in a browser without JavaScript errors.

## Requirements
- Project path: `/home/user/myproject`. Write your Python code in a script named `build_chart.py` under this directory.
- Use `data.movies.url` from `vega_datasets` as the data source (URL-based source; declare types explicitly).
- Pre-filter rows where `IMDB_Rating` is null or `Rotten_Tomatoes_Rating` is null so that no records with missing values reach any view.
- Define an interval (2D) selection that acts as the cross-filter brush.
- Compose three linked views into a single dashboard with the layout: View A on top, with View B and View C side-by-side underneath.
  1. **View A (scatter, brush host)**: `mark_point` of `IMDB_Rating` (x) vs `Rotten_Tomatoes_Rating` (y). Points inside the brush are colored by `Major_Genre`; points outside are colored a flat `'lightgray'`. The brush selection must be attached to this view.
  2. **View B (genre bar)**: `mark_bar` of `count()` by `Major_Genre`, filtered through the brush. Restrict to the top 8 most frequent `Major_Genre` values via a `transform_filter` so the bar chart stays compact.
  3. **View C (rating histogram)**: `mark_bar` histogram of `IMDB_Rating` (`bin(maxbins=20)`) with `count()`, filtered through the brush.
- Save the final dashboard as a single self-contained HTML file to `/home/user/myproject/chart.html` using `chart.save(...)`.

## Implementation Hints
- Create the brush once with `alt.selection_interval(...)` and reuse it across views: attach it via `add_params` on the scatter view, and reference it from `alt.when(brush).then(...).otherwise(alt.value('lightgray'))` for the scatter color and from `transform_filter(brush)` on the bar and histogram views.
- Compose the layout with the `&` (vertical concat) and `|` (horizontal concat) operators or `alt.vconcat` / `alt.hconcat`. The final dashboard should look like `scatter & (bar | histogram)`.
- Pre-filter null `IMDB_Rating` and `Rotten_Tomatoes_Rating` rows with `transform_filter` (e.g. `alt.datum.IMDB_Rating != None`); apply the null-filter on every view (the scatter view additionally excludes null `Rotten_Tomatoes_Rating`).
- Restrict View B to the top 8 most frequent `Major_Genre` values; a common pattern is to compute the count per genre with `transform_aggregate` + `transform_window` (or a similar ranking approach) and then `transform_filter` on the rank.
- URL-based data requires explicit type shorthands (e.g. `IMDB_Rating:Q`, `Major_Genre:N`).
- The output HTML must contain the Vega-Lite spec rendered by `vegaEmbed` so that opening it in a browser renders the dashboard and the brush is interactive.

