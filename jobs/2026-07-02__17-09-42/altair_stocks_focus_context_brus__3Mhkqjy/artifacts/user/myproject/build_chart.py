"""Build a focus + context Vega-Altair visualization of the S&P 500 dataset.

The output is a self-contained HTML file at `/home/user/myproject/chart.html`
that embeds two vertically-concatenated area charts:
- Top (focus/detail): a 600x250 area chart whose x-scale domain is bound to the
  brush selection so it dynamically rescales to the brushed time window.
- Bottom (context/overview): a 600x70 area chart that hosts the interval brush
  the user can drag across the time axis.

The data source is the URL-based ``data.sp500.url`` from ``vega_datasets``,
with explicit type shorthands (``date:T``, ``price:Q``) as required for URL
inputs in Vega-Lite / Vega-Altair.
"""

import altair as alt
from vega_datasets import data


def build_chart() -> alt.VConcatChart:
    """Construct the focus + context chart and return it."""
    # URL-based data source; types must be declared explicitly.
    sp500_url = data.sp500.url

    # Single interval brush, restricted to the x (time) axis.
    brush = alt.selection_interval(encodings=["x"])

    # Shared base encoding (date:T -> price:Q) so both views stay aligned.
    base = (
        alt.Chart(sp500_url)
        .mark_area()
        .encode(
            x="date:T",
            y="price:Q",
        )
    )

    # Upper (focus) view: x-scale domain is bound to the brush selection so
    # the view dynamically rescales to the brushed window.
    detail = base.encode(
        x=alt.X("date:T", scale=alt.Scale(domain=brush)),
    ).properties(
        width=600,
        height=250,
    )

    # Lower (context) view: hosts the draggable brush.
    overview = base.encode(
        x="date:T",
    ).properties(
        width=600,
        height=70,
    ).add_params(brush)

    # Vertically concat with the focus chart on top, context chart on bottom.
    chart = alt.vconcat(detail, overview)
    return chart


def main() -> None:
    chart = build_chart()
    chart.save("/home/user/myproject/chart.html")


if __name__ == "__main__":
    main()
