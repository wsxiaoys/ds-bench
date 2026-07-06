"""Focus + context S&P 500 brush visualization with Vega-Altair.

Builds a vertically stacked overview + detail chart of the S&P 500 dataset.
A small overview area chart at the bottom hosts an interval brush over the
time axis, and a larger detail area chart at the top dynamically rescales
its x-axis to the brushed time window. The result is exported to a
self-contained HTML file that fully renders in a browser, including the
interactive linked brushing behavior.
"""

import altair as alt
from vega_datasets import data


# Single interval brush selection limited to the x (time) axis. This is the
# shared selection that drives rescaling on the detail view and is dragged on
# the context view.
brush = alt.selection_interval(encodings=["x"])

# Shared base chart using a URL-based data source. Explicit type shorthands
# (date:T, price:Q) are required because Altair cannot infer types from a URL.
base = (
    alt.Chart(data.sp500.url)
    .mark_area()
    .encode(x="date:T", y="price:Q")
)

# Upper detail (focus) view: same area mark, but the x-scale's domain is bound
# to the interval brush selection so the chart dynamically rescales to the
# brushed time window.
detail = (
    base.encode(
        x=alt.X("date:T", scale=alt.Scale(domain=brush)),
    )
    .properties(width=600, height=250)
)

# Lower overview (context) view: hosts the draggable brush via add_params.
context = base.properties(width=600, height=70).add_params(brush)

# Vertically concatenate the two views with the detail view on top and the
# context view on the bottom.
chart = detail & context

# Export the compound chart as a single self-contained HTML file that embeds
# the Vega-Lite spec and renders it with vegaEmbed, including the interactive
# linked brushing behavior.
chart.save("/home/user/myproject/chart.html")
