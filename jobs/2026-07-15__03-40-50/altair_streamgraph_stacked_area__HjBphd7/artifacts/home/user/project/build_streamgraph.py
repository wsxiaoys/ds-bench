import altair as alt
import pandas as pd

def main():
    # Load the local dataset
    csv_path = '/home/user/project/data/category_volume.csv'
    df = pd.read_csv(csv_path)

    # Build the streamgraph chart
    chart = alt.Chart(df).mark_area().encode(
        x=alt.X('date:T', timeUnit='yearmonth', axis=alt.Axis(format='%Y')),
        y=alt.Y('volume:Q', aggregate='sum', stack='center', axis=None),
        color=alt.Color('category:N', scale=alt.Scale(scheme='tableau20')),
        tooltip=[
            alt.Tooltip('category:N'),
            alt.Tooltip('date:T', timeUnit='yearmonth'),
            alt.Tooltip('volume:Q', aggregate='sum')
        ]
    ).properties(
        width=800,
        height=400,
        title="Monthly Category Transaction Volume"
    ).interactive().configure_axis(
        grid=False,
        labelFontSize=12,
        titleFontSize=14
    ).configure_view(
        stroke=None
    )

    # Save the chart to a standalone HTML file
    output_path = '/home/user/project/streamgraph.html'
    chart.save(output_path)
    print(f"Streamgraph successfully saved to {output_path}")

if __name__ == '__main__':
    main()
