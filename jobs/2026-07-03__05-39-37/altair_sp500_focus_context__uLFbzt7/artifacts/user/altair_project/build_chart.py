"""Build a Focus + Context S&P 500 dashboard with vega-altair.

Running this script regenerates ``chart.html`` from scratch. The dashboard
combines a large detail area chart with a small overview navigator whose
interval brush controls the detail chart's x-axis domain. A horizontal rule
annotation marks the running maximum price inside the brushed window, computed
entirely within the Vega-Lite spec (no pandas pre-processing).
"""

from pathlib import Path

import altair as alt
from vega_datasets import data

# Use the URL form of the dataset (no pandas download / pre-processing).
source = data.sp500.url

# Interval brush restricted to the x encoding, hosted on the navigator chart.
brush = alt.selection_interval(encodings=["x"])

# ---------------------------------------------------------------------------
# Upper detail chart: filled area of price vs date.
# The x-scale domain follows the brushed range (Focus + Context binding).
# ---------------------------------------------------------------------------
area = alt.Chart(source).mark_area(
    color="steelblue",
    line={"color": "steelblue"},
).encode(
    alt.X("date:T", scale=alt.Scale(domain=brush)),
    alt.Y("price:Q", scale=alt.Scale(zero=False)),
)

# Running-maximum rule annotation layered on top of the detail chart.
# transform_filter narrows the data to the brushed window, then
# transform_aggregate computes the maximum price across that window.
rule = (
    alt.Chart(source)
    .transform_filter(brush)
    .transform_aggregate(max_price="max(price)")
    .mark_rule(color="firebrick", strokeWidth=2, strokeDash=[6, 4])
    .encode(
        y="max_price:Q",
        tooltip=[alt.Tooltip("max_price:Q", title="Running max price")],
    )
)

detail = alt.layer(area, rule).properties(height=400)

# ---------------------------------------------------------------------------
# Lower context chart: same filled area, small height, hosts the brush.
# ---------------------------------------------------------------------------
context = (
    alt.Chart(source)
    .mark_area(color="lightsteelblue")
    .encode(
        alt.X("date:T"),
        alt.Y("price:Q", scale=alt.Scale(zero=False)),
    )
    .add_params(brush)
    .properties(height=60)
)

# Vertical concatenation of the two equal-width panels.
chart = detail & context

OUT_DIR = Path(__file__).resolve().parent
OUT_DIR.mkdir(parents=True, exist_ok=True)
out_path = OUT_DIR / "chart.html"
chart.save(str(out_path))

print(f"Saved dashboard to {out_path}")