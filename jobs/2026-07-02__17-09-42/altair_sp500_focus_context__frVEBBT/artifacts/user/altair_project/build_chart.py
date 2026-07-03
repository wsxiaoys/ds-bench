"""Build a Focus + Context S&P 500 dashboard with Altair.

Produces a self-contained HTML chart with:
  * an upper detail area chart whose x-domain is driven by an interval brush,
  * a lower 60px context area chart that hosts the brush, and
  * a horizontal rule marking the maximum `price` within the brushed window
    (computed in the spec via transform_filter + transform_aggregate).

The data is streamed from `data.sp500.url` (no pandas pre-processing).
"""
from __future__ import annotations

import altair as alt
from vega_datasets import data


def build_chart() -> alt.VConcatChart:
    # Interval brush restricted to the x-axis (canonical Focus+Context pattern).
    brush = alt.selection_interval(encodings=["x"])

    # Shared base: filled area of price vs date, sourced from the vega_datasets URL.
    base = alt.Chart(data.sp500.url).mark_area().encode(
        x=alt.X("date:T", title="Date"),
        y=alt.Y("price:Q", title="Price"),
    )

    # Upper detail chart: x scale domain follows the brush selection.
    upper = base.properties(
        height=400,
        width=600,
        title="S&P 500 — Focus + Context",
    ).encode(
        x=alt.X(
            "date:T",
            scale=alt.Scale(domain=brush),
            title="Date (detail window)",
        )
    )

    # Running-maximum rule inside the brushed window.
    # transform_filter narrows the dataset to the brush range,
    # transform_aggregate collapses it to a single max(price) value,
    # and mark_rule draws a horizontal line at that y across the chart width.
    max_rule = (
        alt.Chart(data.sp500.url)
        .transform_filter(brush)
        .transform_aggregate(max_price="max(price):Q")
        .mark_rule(color="crimson", strokeWidth=2, strokeDash=[4, 3])
        .encode(y=alt.Y("max_price:Q", title="Max price in window"))
    )

    # Lower context chart: hosts the brush, much smaller height.
    lower = base.properties(
        height=60,
        width=600,
        title="Drag a range to zoom the detail chart",
    ).add_params(brush)

    # Vertical concatenation: detail+rule on top, context below.
    chart = (upper + max_rule) & lower
    return chart


def main() -> None:
    chart = build_chart()
    out_path = "/home/user/altair_project/chart.html"
    chart.save(out_path)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()