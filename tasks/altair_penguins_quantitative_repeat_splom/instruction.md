# Penguins Scatter Plot Matrix (SPLOM) with Vega-Altair `repeat`

## Background
Build a 2x2 scatter plot matrix (SPLOM) of the Palmer Penguins dataset using Vega-Altair's `repeat` operator. Each panel must be a small scatter plot of one beak dimension against one body dimension, with points colored by `Species`. The chart must be saved as a static HTML file that fully renders in a browser.

## Requirements
- Write a Python script named `build_chart.py` in the project directory `/home/user/myproject` that can be run with `python3 build_chart.py`.
- Use `data.penguins.url` from `vega_datasets` as the data source (URL-based source; declare types explicitly).
- Render a 2x2 grid of scatter plots produced via the `repeat` operator:
  - `row` repeats over `['Body Mass (g)', 'Flipper Length (mm)']`.
  - `column` repeats over `['Beak Length (mm)', 'Beak Depth (mm)']`.
- Each subplot must:
  - Use `mark_point()`.
  - Encode `x` with `alt.repeat('column')` as a quantitative field, with `scale.zero=False`.
  - Encode `y` with `alt.repeat('row')` as a quantitative field, with `scale.zero=False`.
  - Encode `color` with `Species:N` so points are colored by species.
  - Be sized at `width=180`, `height=180`.
- Save the resulting chart as `/home/user/myproject/chart.html` using `chart.save(...)`.

## Implementation Hints
- Build a single base `alt.Chart(data.penguins.url).mark_point()` and call `.repeat(row=..., column=...)` on it; the `x`/`y` encodings inside the base chart should use `alt.repeat('column')` / `alt.repeat('row')` so that each panel automatically substitutes the correct field name.
- Because the data source is a URL, the `x`/`y` encodings cannot infer types from a pandas DataFrame: declare them as quantitative via the `type='quantitative'` argument of `alt.X` / `alt.Y`.
- Use `alt.Scale(zero=False)` (or `.scale(zero=False)`) on both axes so that the scatter plots do not pad the axes down to zero.
- The color legend should be shared across all panels (this is the default for `repeat`); do not disable it.
- Use `chart.save('/home/user/myproject/chart.html')` so the output is a self-contained HTML page that loads Vega/Vega-Lite/vega-embed from a CDN.

