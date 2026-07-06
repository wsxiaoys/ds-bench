import altair as alt
from vega_datasets import data

# Use data.sp500.url from vega_datasets
source = data.sp500.url

# Define a single Vega-Altair selection: an interval brush limited to the x (time) axis
brush = alt.selection_interval(encodings=['x'])

# Build a shared base chart whose encodings can be reused
base = alt.Chart(source).mark_area().encode(
    x='date:T',
    y='price:Q'
)

# Upper detail view:
# - Width 600, height 250
# - Override x encoding to bind its scale domain to the brush selection
detail = base.encode(
    alt.X('date:T').scale(domain=brush)
).properties(
    width=600,
    height=250
)

# Lower overview view:
# - Width 600, height 70
# - Attach the interval brush selection to this view using add_params
overview = base.properties(
    width=600,
    height=70
).add_params(
    brush
)

# Combine the two views vertically with the detail view on top and overview on the bottom
chart = alt.vconcat(detail, overview)

# Save the resulting compound chart as a single self-contained HTML file
chart.save('/home/user/myproject/chart.html')
