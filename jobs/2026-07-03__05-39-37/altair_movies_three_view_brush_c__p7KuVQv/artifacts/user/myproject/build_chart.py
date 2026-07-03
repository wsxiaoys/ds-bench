#!/usr/bin/env python3
"""
Three-view brush crossfilter dashboard for the movies dataset (Vega-Altair).

View A (top)        : scatter of IMDB_Rating vs Rotten_Tomatoes_Rating, brush host.
View B (bottom-left): bar chart of count() by Major_Genre (top 8), brush-filtered.
View C (bottom-right): histogram of IMDB_Rating (bin maxbins=20), brush-filtered.

Dragging a 2D brush over the scatter updates the bar chart and histogram below
so that only rows whose scatter point lies inside the brush are counted.
"""

import altair as alt
from vega_datasets import data

# ---------------------------------------------------------------------------
# Data source (URL-based; types declared explicitly in encodings)
# ---------------------------------------------------------------------------
source = data.movies.url

# ---------------------------------------------------------------------------
# Reusable null-filter expressions.
#   datum.IMDB_Rating !== null   -> True when the value is present.
# Applied to every view so no missing-value record reaches any chart.
# ---------------------------------------------------------------------------
imdb_valid = alt.datum.IMDB_Rating != None          # noqa: E711
rt_valid = alt.datum.Rotten_Tomatoes_Rating != None  # noqa: E711

# ---------------------------------------------------------------------------
# Single 2D interval selection reused across all three views.
#   * attached to the scatter via add_params (brush host)
#   * referenced by alt.condition(...) for scatter colour
#   * referenced by transform_filter(brush) on the bar & histogram
# ---------------------------------------------------------------------------
brush = alt.selection_interval(encodings=["x", "y"], name="brush")

# ---------------------------------------------------------------------------
# View A — scatter (brush host)
#   Points inside the brush are coloured by Major_Genre; points outside are
#   coloured a flat 'lightgray'.
# ---------------------------------------------------------------------------
scatter = (
    alt.Chart(source, title="IMDB vs Rotten Tomatoes Rating")
    .mark_point(filled=True, opacity=0.6)
    .encode(
        x=alt.X("IMDB_Rating:Q", title="IMDB Rating", scale=alt.Scale(zero=False)),
        y=alt.Y(
            "Rotten_Tomatoes_Rating:Q",
            title="Rotten Tomatoes Rating",
            scale=alt.Scale(zero=False),
        ),
        color=alt.condition(
            brush, "Major_Genre:N", alt.value("lightgray"), legend=None
        ),
        tooltip=[
            "Title:N",
            "Major_Genre:N",
            "IMDB_Rating:Q",
            "Rotten_Tomatoes_Rating:Q",
        ],
    )
    .add_params(brush)
    .transform_filter(imdb_valid)
    .transform_filter(rt_valid)
    .properties(width=600, height=400)
)

# ---------------------------------------------------------------------------
# View B — genre bar chart (top 8, brush-filtered)
#   1. Apply null + brush filters so only brushed, non-null rows remain.
#   2. Aggregate count() per Major_Genre.
#   3. Window-rank genres by count (descending).
#   4. Keep only the top 8 so the bar chart stays compact.
# ---------------------------------------------------------------------------
bar = (
    alt.Chart(source, title="Count by Major Genre (top 8)")
    .mark_bar()
    .encode(
        y=alt.Y("Major_Genre:N", sort="-x", title="Major Genre"),
        x=alt.X("count:Q", title="Count"),
        color=alt.Color("Major_Genre:N", legend=None),
    )
    .transform_filter(imdb_valid)
    .transform_filter(brush)
    .transform_aggregate(count="count()", groupby=["Major_Genre"])
    .transform_window(
        rank="rank()",
        sort=[alt.SortField("count", order="descending")],
    )
    .transform_filter(alt.datum.rank <= 8)
    .properties(width=300, height=400)
)

# ---------------------------------------------------------------------------
# View C — IMDB rating histogram (brush-filtered)
#   Bin IMDB_Rating into 20 bins and count records, filtered through the brush.
# ---------------------------------------------------------------------------
hist = (
    alt.Chart(source, title="IMDB Rating Distribution")
    .mark_bar()
    .encode(
        x=alt.X("IMDB_Rating:Q", bin=alt.Bin(maxbins=20), title="IMDB Rating"),
        y=alt.Y("count():Q", title="Count"),
        color=alt.value("steelblue"),
    )
    .transform_filter(imdb_valid)
    .transform_filter(brush)
    .properties(width=300, height=400)
)

# ---------------------------------------------------------------------------
# Compose: scatter on top, bar | histogram side-by-side underneath.
# ---------------------------------------------------------------------------
dashboard = (scatter & (bar | hist)).configure_view(stroke=None)

# ---------------------------------------------------------------------------
# Export to a single self-contained HTML file.
# ---------------------------------------------------------------------------
OUTPUT = "/home/user/myproject/chart.html"
# inline=True bundles the Vega/Vega-Lite/Vega-Embed JS directly into the HTML
# so the file is fully self-contained (no external CDN requests required).
dashboard.save(OUTPUT, inline=True)
print(f"Saved self-contained dashboard to {OUTPUT}")