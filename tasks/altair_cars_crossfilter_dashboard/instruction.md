# Cross-Filtering Dashboard on the Cars Dataset with Vega-Altair

## Background
Vega-Altair is a declarative statistical visualization library for Python that compiles to Vega-Lite. In this task you will build a cross-filtering interactive dashboard for the classic `cars` dataset (available as `vega_datasets.data.cars`). The dashboard has three linked views composed with Altair's view-composition operators, and an interval brush in the scatter view that drives `transform_filter` in the other two views.

## Requirements
Produce a single Python entry-point at `/home/user/myproject/solution.py` that, when executed, builds the chart and writes a Vega-embed HTML file to `/home/user/myproject/chart.html`.

The rendered chart must contain exactly three sub-views, composed in the layout `(A | B) & C`:

- **View A — Scatter (`mark_point`)**
  - x: `Horsepower` (quantitative)
  - y: `Miles_per_Gallon` (quantitative)
  - color: `Origin` (nominal)
  - Define a selection interval named `brush` using:
    alt.selection_interval(encodings=['x', 'y'])
  - The selection MUST explicitly include both encodings: 'x' and 'y' (do not rely on defaults).
  - Attach it to View A using add_params(brush).
- **View B — Horizontal bar chart (`mark_bar`)**
  - y: `Origin` (nominal)
  - x: `count()` aggregate (quantitative)
  - Must be filtered by the brush defined in View A using `transform_filter(brush)`.
- **View C — Binned 2D heatmap (`mark_rect`)**
  - x: `Weight_in_lbs`, binned
  - y: `Acceleration`, binned
  - color: `count()` aggregate (quantitative)
  - Must be filtered by the brush defined in View A using `transform_filter(brush)`.


Compose the three views as `(A | B) & C` using Altair's `|` and `&` operators (so the top-level Vega-Lite spec is a `vconcat` whose first row is an `hconcat` of A and B, and whose second row is C).

## Implementation Hints
- Use `vega_datasets.data.cars` (or `data.cars.url`) as the input data.
- Define one `selection_interval` (Altair 5+ API) and attach it with `add_params(...)` on View A; reuse the same selection inside `transform_filter(...)` on Views B and C so brushing in A cross-filters B and C.
- Save the chart with `chart.save('/home/user/myproject/chart.html')` so that the resulting HTML embeds the full Vega-Lite spec.
- Avoid hard-coding visual styling such as widths, fonts, color palettes, or titles — the verifier intentionally ignores these.
- View A must use:
  mark_point()
  encoding.x.field = "Horsepower"
  encoding.y.field = "Miles_per_Gallon"
  encoding.color.field = "Origin"
- View C MUST use explicit binning that produces Vega-Lite bin: true semantics:
  alt.X("Weight_in_lbs", bin=True)
  alt.Y("Acceleration", bin=True)
