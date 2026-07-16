# Streamgraph of Category Volume over Time with Vega-Altair

## Background
You are building a static, self-contained data-visualization artifact for an analytics report. Using the declarative [Vega-Altair](https://altair-viz.github.io/) library, you must turn a local time-series dataset into an interactive **streamgraph** (a stacked area chart whose baseline is wiggled to the center) and export it as a standalone HTML file. No network access is available; everything runs locally.

The environment already contains a local dataset describing weekly transaction volume for several business categories.

## Requirements
- Read the local CSV dataset and build a single Altair chart that is a **streamgraph**: an area mark whose stack baseline is centered.
- Aggregate the raw weekly rows up to a monthly resolution (sum of volume per category per month) inside the chart specification (do not pre-aggregate in pandas).
- Encode time on the x-axis, the aggregated volume on the y-axis, and the category on color using a categorical color scheme.
- Add interactive tooltips and enable interactive zoom/pan on the x-scale.
- Apply a report-friendly axis/view configuration (theming) so the chart looks clean.
- Export the finished chart to a standalone HTML file and make sure the file is actually written.

## Implementation Hints
- Use `alt.Chart` with `mark_area` and set the y encoding's stack mode to `"center"` to obtain the streamgraph shape; hide the y-axis by setting its axis to `None`.
- Perform the monthly rollup declaratively: apply the `yearmonth` time unit to the temporal x field and use a `sum` aggregate on the volume field inside the encoding, so the spec carries the aggregation (no pandas groupby).
- Named color schemes are set through the color channel's scale.
- `interactive()` adds a scale-bound interval selection for zoom/pan.
- Chart-level configuration methods (e.g. axis/view configuration) control the theme.
- Saving to `.html` embeds the full Vega-Lite spec inline; verification inspects that embedded spec.
- Project path: /home/user/project
- Input dataset (already present): `/home/user/project/data/category_volume.csv` with exactly the columns `date` (ISO date string, weekly), `category` (string), and `volume` (integer). Do NOT modify this file.
- Command (rerunnable, run from the project directory): `python3 build_streamgraph.py`
- Output artifact: `/home/user/project/streamgraph.html` (a standalone Vega-Embed HTML document).
- Hard requirements the embedded Vega-Lite spec MUST satisfy:
  - The mark type is `area`.
  - The x channel encodes field `date` with time unit `yearmonth`, type `temporal`, and its axis `format` is `"%Y"`.
  - The y channel encodes field `volume` with aggregate `sum`, type `quantitative`, stack `"center"`, and a hidden axis (axis is null).
  - The color channel encodes field `category` (nominal) with scale scheme `"tableau20"`.
  - A `tooltip` encoding is present and includes the category field, the `yearmonth` of `date`, and the summed `volume`.
  - The chart is interactive: the spec contains a parameter whose `bind` is `"scales"`.
  - Axis configuration sets `grid` to `false`, `labelFontSize` to `12`, and `titleFontSize` to `14`.
  - View configuration removes the outer border (view `stroke` is null).

