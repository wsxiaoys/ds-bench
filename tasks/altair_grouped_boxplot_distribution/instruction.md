# Grouped, Faceted Box Plots of Tensile Strength with Vega-Altair

## Background
A metallurgy QA team wants a single interactive HTML report that compares the distribution of measured tensile strength across several aluminium alloys. Each alloy was produced with two heat-treatment conditions and sampled from two different suppliers. You will build a grouped, faceted box-plot visualization with **Vega-Altair** (Altair 6) and export it to a self-contained HTML file.

A local measurement dataset has already been prepared for you as a CSV file (see the paths below). It contains one row per measured coupon.

## Requirements
- Read the local CSV dataset with pandas (do **not** fetch any remote/URL dataset; use only the local file).
- Build a **box-plot** visualization (`mark_boxplot`) that shows the distribution of the measured strength value.
- Place the alloy category on the x axis and the measured strength on the y axis.
- Colour each box by the heat-treatment condition, and dodge the differently-coloured boxes side-by-side within each alloy so they do not overlap.
- Facet the whole plot into one column per supplier.
- Customize the whisker extent, the box/median tick size, enable the whisker end-cap ticks, and give both axes custom titles.
- Save the chart as a single HTML file.

## Implementation Hints
- Use Altair's method-based syntax (e.g. `alt.X(...).axis(title=...)`, `alt.Y(...).scale(zero=False)`).
- The box side-by-side dodging within a category is achieved with the offset channel; the column facet is a separate encoding channel.
- The chart data must be embedded locally in the output (loading the CSV into a pandas DataFrame and passing it to `alt.Chart` inlines the data automatically). The resulting spec must contain **no** remote data `url`.
- The whole pipeline runs offline; do not rely on any network access.

### Hard requirements (must match exactly)
- Project path: `/home/user/altair_boxplot`
- Input dataset (already present): `/home/user/altair_boxplot/data/measurements.csv` with columns `alloy`, `treatment`, `supplier`, `strength_mpa`.
- Output artifact: `/home/user/altair_boxplot/output/grouped_boxplot.html` (an HTML file produced by Altair's chart save).
- The box-plot mark must set: whisker `extent = 2` (numeric IQR multiplier), `size = 40`, and enable whisker end-cap ticks (`ticks = true`).
- Encodings: x = field `alloy` (nominal); y = field `strength_mpa` (quantitative); color = field `treatment` (nominal); the side-by-side dodge (x offset) = field `treatment` (nominal); the column facet = field `supplier` (nominal).
- The y scale must not force zero into the domain (`zero = false`).
- The x axis title must be exactly `Alloy Grade`. The y axis title must be exactly `Tensile Strength (MPa)`.
- Ensure the script is actually executed so that the HTML artifact exists on disk when you are done.

