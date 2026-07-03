import altair as alt
from vega_datasets import data

# Create an interval brush selection limited to the x (time) axis
brush = alt.selection_interval(encodings=['x'])

# Shared base chart (URL-based data source requires explicit type shorthands)
base = alt.Chart(data.sp500.url).mark_area().encode(
    x='date:T',
    y='price:Q'
)

# Upper detail (focus) view: x-scale domain is bound to the brush selection
upper = base.encode(
    x=alt.X('date:T', scale=alt.Scale(domain=brush))
).properties(
    width=600,
    height=250
)

# Lower overview (context) view: the brush is attached to this chart
lower = base.properties(
    width=600,
    height=70
).add_params(brush)

# Vertically concatenate: focus on top, context on bottom
chart = upper & lower

# Save the resulting compound chart as a self-contained HTML file
chart.save('/home/user/myproject/chart.html')
