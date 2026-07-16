import os
import pandas as pd
import altair as alt

def build_and_save_chart():
    # Define paths
    input_path = "/home/user/altair-task/data/measurements.csv"
    output_dir = "/home/user/altair-task/output"
    output_path = os.path.join(output_dir, "chart.html")

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Read the data
    print(f"Reading data from {input_path}...")
    df = pd.read_csv(input_path)

    # Create the raw observations layer with horizontal jitter
    print("Creating raw observations layer...")
    raw_points = alt.Chart(df).transform_calculate(
        jitter='random() - 0.5'
    ).mark_circle(
        size=30,
        opacity=0.4
    ).encode(
        x=alt.X('group:N', title='Treatment Group', scale=alt.Scale(padding=0.6)),
        y=alt.Y('response:Q', title='Measured Response', scale=alt.Scale(zero=False)),
        xOffset=alt.XOffset('jitter:Q', scale=alt.Scale(range=[-20, 20])),
        color=alt.Color('group:N', scale=alt.Scale(scheme='set1'), legend=None),
        tooltip=[
            alt.Tooltip('group:N', title='Group'),
            alt.Tooltip('response:Q', title='Response', format='.4f')
        ]
    )

    # Create the error bar layer (95% bootstrapped confidence interval of the mean)
    print("Creating error bar layer...")
    error_bars = alt.Chart(df).mark_errorbar(
        extent='ci',
        ticks=True,
        color='#222222',
        thickness=2.5,
        size=16
    ).encode(
        x=alt.X('group:N'),
        y=alt.Y('response:Q')
    )

    # Create the mean layer (prominent point marker)
    print("Creating mean layer...")
    mean_points = alt.Chart(df).mark_point(
        filled=True,
        color='#111111',
        size=120,
        stroke='white',
        strokeWidth=1.5
    ).encode(
        x=alt.X('group:N'),
        y=alt.Y('response:Q', aggregate='mean'),
        tooltip=[
            alt.Tooltip('group:N', title='Group'),
            alt.Tooltip('response:Q', aggregate='mean', title='Mean Response', format='.4f')
        ]
    )

    # Combine the layers
    print("Combining layers...")
    chart = alt.layer(
        raw_points,
        error_bars,
        mean_points
    ).properties(
        width=450,
        height=400,
        title="Response Distribution and 95% Confidence Intervals"
    ).configure_view(
        stroke=None  # Remove outer border around the plot area
    ).configure_axis(
        grid=False,
        labelFont='Arial',
        titleFont='Arial',
        labelFontSize=11,
        titleFontSize=13,
        titlePadding=10
    ).configure_axisY(
        grid=True,
        gridColor='#e5e5e5',
        gridDash=[4, 4]
    ).configure_title(
        font='Arial',
        fontSize=16,
        fontWeight='bold',
        anchor='start',
        color='#222222',
        offset=15
    )

    # Save the chart as a standalone HTML file
    print(f"Saving chart to {output_path}...")
    chart.save(output_path)
    print("Chart saved successfully!")

if __name__ == "__main__":
    build_and_save_chart()
