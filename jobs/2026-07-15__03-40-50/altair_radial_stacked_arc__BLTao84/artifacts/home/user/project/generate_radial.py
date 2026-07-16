import altair as alt
import pandas as pd

# Define the dataset
data = pd.DataFrame({
    'source': ['Organic Search', 'Direct', 'Referral', 'Social', 'Email', 'Paid Ads'],
    'visits': [3120, 1980, 1520, 1360, 880, 640]
})

# Color encoding configuration
color_encoding = alt.Color(
    'source:N',
    scale=alt.Scale(scheme='tableau20'),
    legend=alt.Legend(title='Traffic Source')
)

# Left View: Layered Radial Arc Chart
left_base = alt.Chart(data)

# Bottom layer: arc mark with non-zero innerRadius (donut)
# Its theta encodes visits as stacked quantitative value, and radius encodes visits with sqrt scale.
left_arcs = left_base.mark_arc(innerRadius=40).encode(
    theta=alt.Theta('visits:Q', stack=True),
    radius=alt.Radius('visits:Q', scale=alt.Scale(type='sqrt', range=[60, 160])),
    color=color_encoding
)

# Top layer: text mark forming a label ring
left_text = left_base.mark_text(radiusOffset=10, fontSize=11, fontWeight='bold').encode(
    theta=alt.Theta('visits:Q', stack=True),
    radius=alt.Radius('visits:Q', scale=alt.Scale(type='sqrt', range=[60, 160])),
    text='source:N',
    color=alt.value('black') # Use black text for high readability and clean appearance
)

left_view = alt.layer(left_arcs, left_text).properties(
    title=alt.Title('Visits Distribution by Acquisition Channel', anchor='middle'),
    width=350,
    height=350
)

# Right View: Companion Normalized Radial Arc Chart
# Its theta encodes visits with normalized stacking (share of total)
right_view = alt.Chart(data).mark_arc(innerRadius=40, outerRadius=120).encode(
    theta=alt.Theta('visits:Q', stack='normalize'),
    color=color_encoding
).properties(
    title=alt.Title('Acquisition Channel Share of Total (%)', anchor='middle'),
    width=350,
    height=350
)

# Combine the two views side by side (horizontal concatenation)
chart = alt.hconcat(
    left_view,
    right_view
).resolve_legend(
    color='shared'
).properties(
    title=alt.Title(
        text='Acquisition Channel Performance Dashboard',
        subtitle=['Radial Stacked Arc & Share Comparison', 'Data: Website Visits by Acquisition Channel'],
        anchor='middle',
        fontSize=16,
        fontWeight='bold',
        dy=-10
    )
)

# Save the final composed chart to /home/user/project/radial.html
chart.save('/home/user/project/radial.html')
print("Successfully saved radial dashboard to /home/user/project/radial.html")
