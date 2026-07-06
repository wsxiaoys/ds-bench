"""
Focus + Context S&P 500 Brush Range with Vega-Altair
=====================================================

Creates an overview + detail (focus + context) visualization of the S&P 500
dataset using Vega-Altair. The lower overview chart hosts an interval brush
over the time axis; the upper detail chart dynamically rescales its x-axis to
the brushed time window. The compound chart is exported to a self-contained
HTML file.
"""

import altair as alt
from vega_datasets import data


def build_chart() -> alt.LayerChart:
    """Build and return the focus + context S&P 500 chart."""

    # Interval brush limited to the x (time) axis.
    brush = alt.selection_interval(encodings=["x"])

    # Shared base chart using the URL-based sp500 data source.
    # Explicit type shorthands (date:T, price:Q) are required for URL data.
    base = alt.Chart(data.sp500.url).mark_area().encode(
        x=alt.X("date:T"),
        y=alt.Y("price:Q"),
    )

    # Upper detail (focus) view:
    #   - x-scale domain is bound to the interval brush selection
    #   - larger height (250) for the detailed view
    detail = base.encode(
        x=alt.X("date:T", scale=alt.Scale(domain=brush)),
        y=alt.Y("price:Q"),
    ).properties(
        width=600,
        height=250,
    )

    # Lower overview (context) view:
    #   - same mark_area over the same data
    #   - shorter height (70)
    #   - the interval brush is attached here so the user can drag it
    overview = base.properties(
        width=600,
        height=70,
    ).add_params(brush)

    # Vertically concatenate: focus on top, context on bottom.
    chart = alt.vconcat(detail, overview)

    return chart


def main() -> None:
    chart = build_chart()
    output_path = "/home/user/myproject/chart.html"
    chart.save(output_path)
    print(f"Chart saved to {output_path}")


if __name__ == "__main__":
    main()