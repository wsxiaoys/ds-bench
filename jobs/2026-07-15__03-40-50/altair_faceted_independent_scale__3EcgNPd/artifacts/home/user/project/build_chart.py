import pandas as pd
import altair as alt

# 1. Load the data
df = pd.read_csv('/home/user/project/metrics.csv')

# Ensure date is parsed as datetime so Altair treats it as a true temporal field
df['date'] = pd.to_datetime(df['date'])

# 2. Define the hover selection
# This selection captures the nearest point on the 'date' field when hovering.
# By projecting on 'date', hovering over a date in one panel will also highlight
# the corresponding date in other panels, creating a synchronized hover experience.
hover = alt.selection_point(
    on='pointerover',
    nearest=True,
    fields=['date'],
    empty=False
)

# 3. Build the base layers
base = alt.Chart(df)

# Line layer
line = base.mark_line(strokeWidth=2).encode(
    x=alt.X('date:T', title='Date'),
    y=alt.Y('value:Q', title='Value'),
    color=alt.Color('series:N', title='Metric Series')
)

# Gray vertical rule that highlights the selected date across all panels
hover_rule = base.mark_rule(color='#999999', strokeWidth=1, strokeDash=[4, 4]).encode(
    x='date:T',
    opacity=alt.condition(hover, alt.value(0.7), alt.value(0))
)

# Transparent selectors layer (using vertical rules) to capture hover events easily
# Using strokeWidth=15 makes the hover targets wide, so hovering anywhere near a date
# immediately and smoothly triggers the tooltip and highlights the point.
selectors = base.mark_rule(opacity=0.001, strokeWidth=15).encode(
    x='date:T',
    tooltip=[
        alt.Tooltip('date:T', title='Date', format='%Y-%m-%d'),
        alt.Tooltip('value:Q', title='Value', format=',.2f')
    ]
).add_params(
    hover
)

# Highlighted points layer that displays when hovered
points = base.mark_point(size=60, filled=True).encode(
    x='date:T',
    y='value:Q',
    color=alt.Color('series:N'),
    opacity=alt.condition(hover, alt.value(1), alt.value(0))
)

# Layer the charts and set standard panel dimensions
layered = alt.layer(line, hover_rule, selectors, points).properties(
    width=350,
    height=220
)

# 4. Facet the chart into a 2x2 grid (wrapped with 2 columns)
# We facet by 'series' and resolve the y-scale to be independent for each panel,
# while keeping the color scale shared (default).
chart = layered.facet(
    facet=alt.Facet('series:N', title=None),
    columns=2
).resolve_scale(
    y='independent'
).properties(
    title=alt.TitleParams(
        text="Web Service Operational Metrics Over Time",
        subtitle="Faceted small-multiple line charts with independent Y-axis scales and synchronized hover tooltips",
        anchor='start',
        fontSize=18,
        subtitleFontSize=13,
        offset=20
    )
).configure_view(
    stroke=None  # Remove the border around each panel for a cleaner modern look
)

# 5. Save the chart as a standalone HTML file
chart.save('/home/user/project/chart.html')
print("Chart successfully generated and saved to /home/user/project/chart.html")
