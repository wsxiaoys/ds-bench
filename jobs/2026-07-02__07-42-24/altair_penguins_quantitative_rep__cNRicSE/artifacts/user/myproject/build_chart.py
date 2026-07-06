#!/usr/bin/env python3
"""
This script builds a 2x2 scatter plot matrix (SPLOM) of the Palmer Penguins dataset
using Vega-Altair's repeat operator.

The resulting chart is saved as a static HTML file: /home/user/myproject/chart.html.
"""

import altair as alt
from vega_datasets import data

# Ensure data.penguins is available on vega_datasets.data (e.g. for older package versions)
if not hasattr(data, 'penguins'):
    try:
        from altair.datasets import data as altair_data
        data.penguins = altair_data.penguins
    except Exception:
        class PenguinsDataset:
            url = "https://cdn.jsdelivr.net/npm/vega-datasets@v3.2.1/data/penguins.json"
        data.penguins = PenguinsDataset()

def build_and_save_chart():
    # Define the 2x2 scatter plot matrix (SPLOM) using the repeat operator
    chart = alt.Chart(data.penguins.url).mark_point().encode(
        x=alt.X(
            alt.repeat('column'),
            type='quantitative',
            scale=alt.Scale(zero=False)
        ),
        y=alt.Y(
            alt.repeat('row'),
            type='quantitative',
            scale=alt.Scale(zero=False)
        ),
        color='Species:N'
    ).properties(
        width=180,
        height=180
    ).repeat(
        row=['Body Mass (g)', 'Flipper Length (mm)'],
        column=['Beak Length (mm)', 'Beak Depth (mm)']
    )

    # Save the chart as a static HTML file
    chart.save('/home/user/myproject/chart.html')
    print("Chart successfully saved to /home/user/myproject/chart.html")

if __name__ == '__main__':
    build_and_save_chart()
