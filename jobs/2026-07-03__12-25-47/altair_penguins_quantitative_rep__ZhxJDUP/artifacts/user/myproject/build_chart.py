import altair as alt
from vega_datasets import data

chart = (
    alt.Chart(data.penguins.url)
    .mark_point()
    .encode(
        x=alt.X(alt.repeat('column'), type='quantitative', scale=alt.Scale(zero=False)),
        y=alt.Y(alt.repeat('row'), type='quantitative', scale=alt.Scale(zero=False)),
        color=alt.Color('Species:N'),
    )
    .properties(width=180, height=180)
    .repeat(
        row=['Body Mass (g)', 'Flipper Length (mm)'],
        column=['Beak Length (mm)', 'Beak Depth (mm)'],
    )
)

chart.save('/home/user/myproject/chart.html')
