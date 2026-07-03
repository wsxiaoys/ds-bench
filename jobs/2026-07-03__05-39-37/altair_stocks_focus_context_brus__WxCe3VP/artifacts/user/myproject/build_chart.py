"""Focus + Context (overview + detail) Vega-Altair chart of the S&P 500.

A small overview area chart at the bottom hosts an interval brush over the
time axis. A larger detail area chart at the top dynamically rescales its
x-axis to the brushed time window. The compound chart is exported to a
self-contained HTML file that fully renders in a browser.
"""

import altair as alt
from vega_datasets import data


# The S&P 500 dataset, referenced by URL (URL-based source requires explicit
# type shorthands in the encodings, e.g. date:T, price:Q).
source = data.sp500.url

# Single interval brush limited to the x (time) axis.
brush = alt.selection_interval(encodings=['x'])

# Shared base chart reused across both views.
base = alt.Chart(source).mark_area().encode(
    x='date:T',
    y='price:Q',
)

# Upper detail (focus) view: its x-scale domain is bound to the brush
# selection, so it rescales to the brushed time window.
upper = base.encode(
    x=alt.X('date:T', scale=alt.Scale(domain=brush)),
).properties(
    width=600,
    height=250,
)

# Lower overview (context) view: the brush is attached here so the user can
# drag the interval on this chart.
lower = base.properties(
    width=600,
    height=70,
).add_params(brush)

# Vertically concatenate: focus on top, context on the bottom.
chart = alt.vconcat(upper, lower)

# Export to a single self-contained HTML file embedding the Vega-Lite spec
# and rendering it with vegaEmbed.
chart.save('/home/user/myproject/chart.html')

print('Saved chart to /home/user/myproject/chart.html')