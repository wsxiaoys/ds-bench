# Faceted Small-Multiple Line Charts with Independent Y Scales (Vega-Altair)

## Background
You are building a monitoring dashboard for a web service using the declarative visualization library Vega-Altair (v5+). The service reports four operational metrics over time, and each metric lives on a completely different numeric range (requests per minute in the thousands, latency in the tens of milliseconds, error rate between 0 and 1, and CPU load as a percentage). Plotting them on a single shared y-axis would flatten most of the series into unreadable lines, so you must render them as a grid of small-multiple line charts where every panel scales its own y-axis independently.

A long-form dataset has already been prepared for you as a local CSV file. Do **not** download any data or reference any remote URL; read only from the local file.

## Requirements
- Read the long-form metrics data from the local CSV file `metrics.csv`. It has exactly three columns: `date` (an ISO date string), `series` (the metric name, one of four nominal categories), and `value` (a quantitative number).
- Produce a faceted small-multiple visualization with one line-chart panel per `series`.
- Arrange the panels as a wrapped grid of exactly **2 columns** (so four series render as a 2x2 grid).
- Each panel must use its **own independent y-axis scale** so that a panel's line uses the full vertical space regardless of the other panels' magnitudes.
- Encode line color by `series`, and keep the color scale **shared** across all panels (one consistent color mapping and a single legend).
- Add a **single shared interactive hover tooltip**: when the pointer moves over a panel, the nearest data point is detected and a tooltip shows that point's `date` and `value`. The same hover interaction must apply across every facet panel (add the interaction once so it is shared, not duplicated per panel).
- Save the final chart as a standalone, self-contained HTML file named `chart.html`.

## Implementation Hints
- Project path: /home/user/project
- Command: `python3 build_chart.py`
- Input data file: /home/user/project/metrics.csv (already present; read it with pandas).
- Output file: /home/user/project/chart.html (produced by running the command).
- Load the CSV into a pandas DataFrame so Altair infers column types, then build the panel encodings (`x` = `date` temporal, `y` = `value` quantitative, `color` = `series` nominal).
- Wrapped multi-column faceting requires the single-field facet form together with a columns count; a plain column-only facet will not wrap into rows.
- Independent y scales are not an encoding option here: they are resolved on the faceted chart via scale resolution set to independent for the y channel, while color resolution stays shared (the default).
- The hover interaction is a point selection triggered on pointer-over with nearest-point detection; add it to the inner (pre-facet) chart so a single shared parameter drives every panel. Include the `date` and `value` fields in the tooltip encoding.
- The saved HTML must be a complete standalone document that embeds the full Vega-Lite specification and renders in a browser with no network access to any data source.

