# Radial Stacked Arc Dashboard with Vega-Altair

## Background
You are building a self-contained analytics graphic with the declarative visualization library Vega-Altair (Altair 5+). A marketing team wants a single-page radial dashboard that shows how website visits are distributed across acquisition channels. The dashboard must render entirely from data bundled inside the program — it must never fetch any remote dataset or make network calls at build time.

## Requirements
- Build a composed Altair chart from a locally defined dataset of traffic sources and their visit counts.
- Left view: a radial arc plot where the angular extent (theta) encodes the stacked visit count and the radial extent (radius) encodes the visit magnitude, with a text label ring layered on top of the arcs.
- Right view: a companion normalized radial arc that shows each channel's share of the total (angles normalized so the ring sums to 100%).
- Both views must use the same categorical color scheme and a legend, so the colors are consistent across the two views.
- Combine the two views side by side (horizontal concatenation) into one chart and save it as a standalone HTML file.

## Implementation Hints
- Use Altair `mark_arc` with `theta` and `radius` channels for the radial encodings, and layer a `mark_text` chart over the arcs for the label ring.
- The dataset must be embedded/inline (e.g. a pandas DataFrame or `alt.Data`); do NOT reference any remote URL and do NOT call `vega_datasets` remote sources.
- Project path: /home/user/project
- Save the final composed chart to `/home/user/project/radial.html` using Altair's `Chart.save(...)` (this produces a standalone HTML file that embeds the Vega-Lite spec).
- Ensure the program is actually executed so that `/home/user/project/radial.html` exists.
- Use exactly this dataset, with a nominal category field named `source` and a quantitative field named `visits`:
  - Organic Search = 3120
  - Direct = 1980
  - Referral = 1520
  - Social = 1360
  - Email = 880
  - Paid Ads = 640
- The composed chart must be a horizontal concatenation of exactly two views (left = the layered radial arc, right = the normalized radial arc).
- Left view details: it is a two-layer chart. The bottom layer is an `arc` mark with a non-zero `innerRadius` (a donut). Its `theta` encodes `visits` as a stacked quantitative value (default additive stacking), and its `radius` encodes `visits` with a `sqrt` scale. The top layer is a `text` mark whose `text` channel is the `source` field, forming a label ring.
- Right view details: an `arc` mark whose `theta` encodes `visits` with normalized stacking (share of total).
- Color: in both views, encode `color` by the `source` field using the categorical scheme `tableau20`, and show a legend titled `Traffic Source`.

