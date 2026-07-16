# Bump Chart of Category Rankings Over Time with Vega-Altair

## Background
A product analytics team wants a *bump chart*: a visualization that tracks how the relative ranking of several product lines changes across reporting periods. You will build it with [Vega-Altair](https://altair-viz.github.io/), a declarative statistical visualization library for Python. The ranking must be computed declaratively inside the chart specification (via a window transform), not pre-computed in pandas, and the result must be exported as a self-contained HTML file.

## Requirements
- Load the bundled local dataset of quarterly product sales.
- For each reporting period, rank the product lines by sales (highest sales = rank 1). This ranking must be computed with Altair's window transform, producing a field named `rank`.
- Produce a layered bump chart that overlays a line mark and a point mark so each product line is drawn as a connected series with a marker at every period.
- Encode the reporting period on the x axis, the computed `rank` on the y axis with the scale reversed so rank 1 sits at the top, and the product line as color.
- Add a tooltip that reveals the product line, period, rank, and sales for each marker.
- Export the finished chart to a self-contained HTML file that embeds all data locally.

## Implementation Hints
- Use Altair's window transform to compute the ranking: `rank()` sorted by sales in descending order and partitioned (grouped) by the reporting period.
- Build the two marks (line and point) from a shared base so they inherit the same data, transform, and encodings, then combine them into a single layered chart.
- To place rank 1 at the top of the chart, reverse the y scale rather than reordering the data.
- Save with Altair's `Chart.save(...)` so the output is a standalone HTML document (it must contain the Vega-Lite spec and load the Vega/Vega-Lite runtime); do not hand-write HTML.
- Project path: /home/user/project
- Input data file: /home/user/project/data/product_sales.csv (columns: `period`, `category`, `sales`).
- Command: `python3 build_bump_chart.py` (running it must regenerate the output).
- Output file: /home/user/project/chart.html
- Hard requirements the output must satisfy:
  - The window transform must output the ranking into a field named exactly `rank`, sorting by `sales` descending and grouping by `period`.
  - The chart must be a layered spec containing both a `line` mark and a `point` mark.
  - The y channel must encode the `rank` field with its scale reversed (rank 1 at the top).
  - The color channel must encode the `category` field.
  - Each marker's tooltip must expose `category`, `period`, `rank`, and `sales`.
  - All data must be embedded inline in the HTML; the specification must NOT reference any remote dataset URL or network resource.

