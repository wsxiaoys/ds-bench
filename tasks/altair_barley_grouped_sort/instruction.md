# Barley Yield: Grouped Bar Chart with Sorted Sites and Mean Overlay

## Background
You are using Vega-Altair to explore the classic `data.barley` dataset (from `vega_datasets` / `altair.datasets`). Each row records the `yield` of one `variety` of barley grown at one `site` in one `year`. You will build a faceted, grouped bar chart that compares varieties across sites and overlay the per-site average yield on top of each facet.

## Requirements
- Build a single composite Altair chart that uses the `data.barley` dataset.
- For the main mark, use grouped bars showing `mean(yield)` per `(site, variety)`, grouped at each site using the `xOffset` channel.
- Sites on the x-axis must be ordered by aggregated yield, descending (the site with the highest overall mean yield first).
- Color encodes `variety` with the `tableau10` color scheme.
- The chart is faceted by `year` so there is one panel per year present in the dataset.
- Overlay a `mark_tick` (per facet) at the per-site mean yield across all varieties for that year, computed inside the spec with an aggregate transform (not pre-aggregated in pandas).
- The chart carries a title with both a main `text` line and a `subtitle` line.
- Write your python code in a script located at `/home/user/altair_task/build_chart.py`.
- Save the final visualization as a self-contained interactive HTML file at `/home/user/altair_task/output/chart.html`. The page must contain grouped bar marks across at least 2 year facets and tick (or rule) marks for the per-site means.

## Implementation Hints
- Load `data.barley` from `altair.datasets` (or `vega_datasets`) — do not download the file manually.
- Use the method-based encoding syntax (`alt.X(...).sort(field=..., op=..., order=...)`) to control x-axis ordering by an aggregated field.
- Build the grouped bar chart and the per-site mean overlay as separate `alt.Chart` layers over the same data, combine them with `alt.layer(...)` (or the `+` operator), and then call `.facet(...)` on the combined layer with `year:O`.
- For the overlay, derive the per-site mean inside the spec using `transform_aggregate` with a `mean(yield)` aggregation grouped by `site` (and `year`, since the layer is faceted on `year`).
- Pass a title as an object with both `text` and `subtitle` so both lines render in the HTML output.
- Persist the chart using Altair's HTML export so the result is a standalone page that can be opened in a browser.
- Construct the chart directly from data.barley.url (or another named barley dataset reference) so the exported Vega-Lite spec retains an explicit barley dataset reference.
