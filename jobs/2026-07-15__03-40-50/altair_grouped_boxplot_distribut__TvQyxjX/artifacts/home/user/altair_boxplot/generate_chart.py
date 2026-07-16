import os
import pandas as pd
import altair as alt

def main():
    # Read the local CSV dataset with pandas
    csv_path = '/home/user/altair_boxplot/data/measurements.csv'
    df = pd.read_csv(csv_path)

    # Build the box-plot visualization
    chart = alt.Chart(df).mark_boxplot(
        extent=2,
        size=40,
        ticks=True
    ).encode(
        x=alt.X('alloy:N').axis(title='Alloy Grade'),
        y=alt.Y('strength_mpa:Q').axis(title='Tensile Strength (MPa)').scale(zero=False),
        color=alt.Color('treatment:N'),
        xOffset=alt.XOffset('treatment:N'),
        column=alt.Column('supplier:N')
    )

    # Ensure output directory exists
    output_dir = '/home/user/altair_boxplot/output'
    os.makedirs(output_dir, exist_ok=True)

    # Save the chart as a single HTML file
    output_path = os.path.join(output_dir, 'grouped_boxplot.html')
    chart.save(output_path)
    print(f"Chart successfully saved to {output_path}")

if __name__ == '__main__':
    main()
