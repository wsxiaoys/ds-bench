# Interactive Legend Cross-Filter Sales Dashboard (Vega-Altair)

## Background
You are building an offline, self-contained analytics dashboard with the declarative visualization library [Vega-Altair](https://altair-viz.github.io/) (Altair 5+). A retail analyst wants a single dashboard where clicking an entry in the color legend focuses the whole dashboard on one product category, dimming the others in a summary view and hiding the others in a trend view. The dashboard must work entirely offline (no network access) once opened in a browser.

The input dataset is already present on disk as a local CSV file. You must NOT download any remote dataset or reference any external URL.

## Requirements
- Load the local sales data and build ONE combined Altair chart composed of two vertically stacked linked views that share a single interactive legend:
  - A **stacked bar view**: total monthly sales, with bars stacked and colored by product category.
  - A **time-series line view**: monthly sales over time drawn as one line per product category.
- Add a single clickable point selection over the `category` field, bound to the color legend, and shared by both views (so one legend controls the entire dashboard).
- In the stacked bar view, use a conditional encoding so the selected category is fully opaque while the non-selected categories are dimmed.
- In the time-series line view, use a transform filter driven by the same selection so that only the selected category's line is shown (when nothing is selected, all lines are shown).
- Save the result as a single self-contained HTML file that renders without any network access.

## Implementation Hints
- Use Altair 5+ syntax. An interactive legend is created by binding a point selection to the legend, and a single selection object can be reused across concatenated views.
- Conditional opacity can be expressed with Altair's when/then/otherwise (or condition) helper; the trend view can be narrowed with a filter transform that references the same selection.
- Compose the two views into one chart (vertical concatenation) so a single HTML file contains both.
- The bar view should aggregate sales to a monthly sum per category; the line view should show the monthly sales value per category over time.
- Project path: /home/user/project
- Input data file: /home/user/project/data/sales.csv (columns: `date` (ISO date string, first day of each month), `category` (product category name), `sales` (integer units sold)).
- Output file: /home/user/project/dashboard.html
- Ensure the generating script is actually executed so that the output HTML artifact exists on disk.
- The saved HTML must be self-contained and render offline: it must embed the Vega/Vega-Lite/vega-embed runtime and the full data inline (do NOT emit a spec that points at the CSV path or any http(s) data URL).
- The embedded Vega-Lite spec must contain: a point selection parameter with `bind` set to `legend` and projected on the `category` field; a bar mark with a stacked quantitative encoding and a conditional opacity encoding; and a line mark whose view carries a filter transform referencing the selection.

