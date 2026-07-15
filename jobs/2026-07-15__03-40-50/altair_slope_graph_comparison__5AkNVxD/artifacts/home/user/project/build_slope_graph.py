import pandas as pd
import altair as alt

# 1. Load the data
df = pd.read_csv('/home/user/project/data/regional_revenue.csv')

# 2. Build the chart
# We apply a calculate transform to compute the trend (Increase/Decrease)
# We then fold the two years into year_raw and revenue
# We then calculate year from year_raw
# We also calculate label for text mark to display region and revenue on the left, and just revenue on the right
base = alt.Chart(df).transform_calculate(
    trend="datum.revenue_2024 > datum.revenue_2023 ? 'Increase' : 'Decrease'"
).transform_fold(
    ['revenue_2023', 'revenue_2024'],
    as_=['year_raw', 'revenue']
).transform_calculate(
    year="datum.year_raw == 'revenue_2023' ? '2023' : '2024'",
    label="datum.year_raw == 'revenue_2023' ? datum.region + '  $' + datum.revenue : '$' + datum.revenue"
)

# Define shared encoding
shared_encode = base.encode(
    x=alt.X('year:O', axis=alt.Axis(grid=False, title=None, labelFontSize=13, labelFontWeight='bold', orient='bottom', tickSize=0, domain=False)),
    y=alt.Y('revenue:Q', axis=None, scale=alt.Scale(zero=False, padding=20)),
    color=alt.Color('trend:N', scale=alt.Scale(domain=['Increase', 'Decrease'], range=['#2ca02c', '#d62728']), legend=alt.Legend(title="Trend")),
    detail='region:N',
    tooltip=[
        alt.Tooltip('region:N', title='Region'),
        alt.Tooltip('year:N', title='Year'),
        alt.Tooltip('revenue:Q', title='Revenue ($M)', format='$,.0f'),
        alt.Tooltip('trend:N', title='Trend')
    ]
)

# 1. Line mark
lines = shared_encode.mark_line(strokeWidth=3)

# 2. Point mark
points = shared_encode.mark_point(size=100, filled=True)

# 3. Text mark
texts = shared_encode.mark_text(
    align=alt.expr("datum.year == '2023' ? 'right' : 'left'"),
    dx=alt.expr("datum.year == '2023' ? -12 : 12"),
    dy=0,
    fontSize=11,
    fontWeight='bold'
).encode(
    text='label:N'
)

# Layer the three marks
chart = alt.layer(lines, points, texts).properties(
    width=500,
    height=450,
    title=alt.TitleParams(
        text="Regional Revenue Performance (2023 vs 2024)",
        subtitle="Comparing sales region annual revenue movement. Green indicates growth, red indicates decline.",
        fontSize=16,
        subtitleFontSize=12,
        anchor='start',
        dx=20
    )
).configure_view(
    stroke=None
).configure_legend(
    labelFontSize=11,
    titleFontSize=12,
    orient='top-right'
)

# Save the chart as a standalone HTML file
chart.save('/home/user/project/slope_graph.html')
print("Successfully generated slope_graph.html")
