import altair as alt
import pandas as pd

# Define the dataset
data = pd.DataFrame({
    'source': ['Organic Search', 'Direct', 'Referral', 'Social', 'Email', 'Paid Ads'],
    'visits': [3120, 1980, 1520, 1360, 880, 640]
})

# Left view: two-layer chart
# Layer 1: arc mark
left_arcs = alt.Chart(data).mark_arc(innerRadius=40).encode(
    theta=alt.Theta('visits:Q', stack=True),
    radius=alt.Radius('visits:Q', scale=alt.Scale(type='sqrt', range=[60, 160])),
    color=alt.Color('source:N', scale=alt.Scale(scheme='tableau20'), legend=alt.Legend(title='Traffic Source'))
)

# Layer 2: text mark
left_text = alt.Chart(data).mark_text(radiusOffset=15).encode(
    theta=alt.Theta('visits:Q', stack=True),
    radius=alt.Radius('visits:Q', scale=alt.Scale(type='sqrt', range=[60, 160])),
    text='source:N',
    color=alt.Color('source:N', scale=alt.Scale(scheme='tableau20'), legend=None)
)

left_view = alt.layer(left_arcs, left_text)

# Right view: normalized radial arc
right_view = alt.Chart(data).mark_arc(innerRadius=40, outerRadius=120).encode(
    theta=alt.Theta('visits:Q', stack='normalize'),
    color=alt.Color('source:N', scale=alt.Scale(scheme='tableau20'), legend=alt.Legend(title='Traffic Source'))
)

# Concatenate views side-by-side
chart = alt.hconcat(left_view, right_view)

# Print the spec as dictionary to verify
print(chart.to_dict())
