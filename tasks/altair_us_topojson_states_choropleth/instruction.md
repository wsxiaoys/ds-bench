# US State-Level Engineers Choropleth with Vega-Altair

## Background
Build a US state-level choropleth visualization with Vega-Altair using TopoJSON state boundaries and the `population_engineers_hurricanes` dataset. The chart should color each state by the number of engineers and be exported as a static HTML file that renders in a browser.

## Requirements
- Use `alt.topo_feature(data.us_10m.url, 'states')` from `vega_datasets` to load the US state geometries from the `us-10m.json` TopoJSON file.
- Join the state boundaries with `vega_datasets.data.population_engineers_hurricanes.url` using `transform_lookup` keyed on the state FIPS `id` field, pulling at least the `engineers` and `state` fields via `alt.LookupData`.
- Render the states with `mark_geoshape()` and color each state by the looked-up `engineers` field on a `blues` scheme (i.e., the Vega-Lite color scale `scheme` must be `"blues"`).
- Use the `albersUsa` projection so Alaska and Hawaii appear as insets within the US extent.
- Provide an interactive tooltip on hover showing at least the `state` name and the `engineers` count.
- Set the chart `width` to `700` and `height` to `400`.
- Save the resulting chart as a single self-contained HTML file using `chart.save(...)`.

## Implementation Hints
- Use `alt.topo_feature(data.us_10m.url, 'states')` as the chart data source so the embedded Vega-Lite spec carries `data.format.feature == 'states'` and `data.url` pointing at the `us-10m.json` TopoJSON.
- Use `transform_lookup(lookup='id', from_=alt.LookupData(<source_url>, key='id', fields=[...]))` to attach the `engineers` (and `state`) columns to each state geometry via the FIPS id.
- Encode `color` with the `engineers` field and a quantitative scale whose `scheme` is `"blues"`.
- Encode `tooltip` as a list of fields (e.g. `state` and `engineers`).
- Apply the projection with `.project(type='albersUsa')` and set width/height via `.properties(width=700, height=400)`.
- The HTML must contain the Vega-Lite spec embedded in a `<script type="application/json">` block and rendered via `vegaEmbed`.
- Work within `/home/user/myproject` and name your script `build_chart.py`.
- Save the resulting chart exactly to `chart.html` within the project directory.

