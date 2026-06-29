# Back-to-Back Population Age Pyramid with Vega-Altair

## Background
You are building an interactive demographic explorer using Vega-Altair. The goal is to visualize the US population distribution as a back-to-back age pyramid for a single year, with a dropdown widget that lets the viewer switch between different census years from the canonical `data.population.url` dataset.

The dataset (`https://vega.github.io/vega-datasets/data/population.json`) has the columns:
- `year`: integer census year (1850, 1860, ..., 2000).
- `age`: integer age bucket (0, 5, 10, ..., 90).
- `sex`: 1 for male, 2 for female.
- `people`: number of people in that bucket.

## Requirements
- Build a Python script named `build_pyramid.py` under `/home/user/myproject` that generates a single Altair chart spec (using `bar` mark, no faceting, no horizontal concatenation) producing a classic back-to-back age pyramid:
  - Males extend to the left as negative bars, females extend to the right as positive bars.
  - The y axis lists `age` buckets with the oldest age at the top of the chart and the youngest at the bottom.
  - The x axis uses absolute-value labels even though the underlying data is signed (e.g., labels read `10M` on both sides, not `-10M` on the left).
  - Color encodes `sex` with a custom mapping: `1 -> Male` (e.g., steelblue) and `2 -> Female` (e.g., salmon). The legend must show the words "Male" and "Female", not the raw integers.
- The chart must include a `binding_select` dropdown bound to a single `alt.param`. The dropdown's options must be the distinct `year` values present in the dataset, and the chart must be filtered to a single year at a time. The initial selected year must be `1980`.
- The signed value used for the x axis must be computed inside the Vega-Lite spec via a `transform_calculate` step that produces a new field equal to `-people` when `sex == 1` (male) and `people` when `sex == 2` (female). Do **not** pre-compute this field in pandas; it has to live in the spec.
- Save the chart to `/home/user/myproject/pyramid.html` using Altair's `Chart.save(...)` API.
- Also write the underlying Vega-Lite spec (as returned by `Chart.to_dict()`) to `/home/user/myproject/pyramid_spec.json` so the verifier can inspect it.

## Implementation Hints
- The data source must be the URL string `data.population.url` from `altair.datasets` (not a pre-loaded Pandas DataFrame), so encoding type shorthands (`:Q`, `:O`, `:N`) are required.
- Use `transform_calculate` with a Vega expression that branches on `datum.sex` (e.g., `datum.sex === 1 ? -datum.people : datum.people`) to build the signed field.
- Use `transform_filter` together with the year parameter so the dropdown actually controls the displayed year.
- For the x axis labels, configure the axis with a numeric `format` (such as `'s'`) and use the Vega expression `abs(datum.value)` in `labelExpr` to ensure labels are displayed as absolute values.
- For the y axis ordering, use Altair's `sort` option on `alt.Y` (e.g., `'descending'` or `'-age'`) to flip the natural ascending order of the ordinal axis and place the largest age values at the top.
- For the color legend, encode `color` as nominal over the `sex` field with an explicit `scale` (with a `domain` of `[1, 2]` and a `range` of two colors). Use the `labelExpr` option of `alt.Color(...).legend(...)` (referencing `datum.value`) to map `1` to `'Male'` and `2` to `'Female'`.
- The script must be runnable as `python build_pyramid.py` from `/home/user/myproject` and must succeed without network access at *render* time (Altair only embeds the URL into the spec; no fetching is required to produce the HTML).

