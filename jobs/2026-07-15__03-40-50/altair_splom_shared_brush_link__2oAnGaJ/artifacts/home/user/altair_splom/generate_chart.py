import altair as alt
import pandas as pd

def main():
    # 1. Load the provided local CSV dataset with pandas
    csv_path = '/home/user/altair_splom/data/measurements.csv'
    df = pd.read_csv(csv_path)

    # 2. Define the four quantitative features for the SPLOM
    features = ['temperature', 'pressure', 'humidity', 'vibration']

    # 3. Create a single shared interval selection (brush)
    # resolve="global" ensures that there is exactly one interval selection parameter
    # shared globally across all panels. Dragging in any panel updates the highlight everywhere.
    brush = alt.selection_interval(
        name="brush",
        resolve="global"
    )

    # 4. Build the scatterplot matrix (SPLOM) using Altair's repeat operator
    # The repeated x/y encodings are typed as quantitative (:Q) and bind to the repeated fields.
    # The color channel uses a conditional encoding:
    # - Inside the selection: color-coded by nominal machine_class field (:N)
    # - Outside the selection: rendered in neutral light-gray value
    chart = alt.Chart(df).mark_point(size=30, opacity=0.7).encode(
        x=alt.X('repeat(column):Q', scale=alt.Scale(zero=False)),
        y=alt.Y('repeat(row):Q', scale=alt.Scale(zero=False)),
        color=alt.condition(brush, 'machine_class:N', alt.value('lightgray'))
    ).properties(
        width=150,
        height=150
    ).repeat(
        row=features,
        column=features
    ).add_params(
        brush
    )

    # 5. Save the finished chart as a fully self-contained HTML file
    # inline=True embeds the Vega, Vega-Lite, and Vega-Embed JS dependencies inline,
    # so it renders in a browser with no network/internet access.
    output_path = '/home/user/altair_splom/chart.html'
    chart.save(output_path, inline=True)
    print(f"Successfully generated and saved self-contained SPLOM chart to {output_path}")

if __name__ == '__main__':
    main()
