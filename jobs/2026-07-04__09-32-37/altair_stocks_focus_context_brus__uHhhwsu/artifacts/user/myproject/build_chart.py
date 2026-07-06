import altair as alt
from vega_datasets import data

# URL-based data source; explicit types must be declared in the encodings
source = data.sp500.url

# Single interval brush selection limited to the x (time) axis
brush = alt.selection_interval(encodings=['x'])

# Shared base chart
base = alt.Chart(source).mark_area().encode(
    x='date:T',
    y='price:Q'
)

# Upper detail (focus) view: x-scale domain bound to the brush
detail = base.properties(
    width=600,
    height=250
).encode(
    x=alt.X('date:T', scale=alt.Scale(domain=brush))
)

# Lower overview (context) view: hosts the brush via add_params
overview = base.properties(
    width=600,
    height=70
).add_params(
    brush
)

# Vertically concatenate: focus on top, context on bottom
chart = alt.vconcat(detail, overview)

# Save as a self-contained HTML file
chart.save('/home/user/myproject/chart.html')
print('chart.html created successfully')
