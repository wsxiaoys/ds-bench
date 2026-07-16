import os
import pandas as pd
import altair as alt

def main():
    # Define paths relative to the project directory
    csv_path = 'data/cash_flow.csv'
    html_path = 'waterfall.html'

    # Ensure we are in the correct directory if needed, but the prompt says run from project directory
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Input data file not found at {csv_path}. Please run from the project directory.")

    # Load the local CSV file
    df = pd.read_csv(csv_path)

    # Add an index column to preserve row order
    df['order'] = range(len(df))

    # Define the base chart with data and transforms
    base = alt.Chart(df).transform_window(
        cumsum='sum(amount)',
        sort=[{'field': 'order'}]
    ).transform_calculate(
        # Compute start (y) and end (y2) positions for the bars
        y="datum.label === 'Begin' || datum.label === 'End' ? 0 : datum.cumsum - datum.amount",
        y2="datum.cumsum",
        # Classify the bars into three categories for color-coding
        lead="datum.label === 'Begin' || datum.label === 'End' ? 'Total' : (datum.amount > 0 ? 'Increase' : 'Decrease')",
        # Compute the vertical position of the text labels (top of the bar)
        text_y="datum.amount >= 0 ? datum.y2 : datum.y",
        # Compute the text label displaying the delta amount (or total for End)
        label_text="datum.label === 'End' ? format(datum.cumsum, ',d') : (datum.label === 'Begin' ? format(datum.amount, ',d') : (datum.amount > 0 ? '+' : '') + format(datum.amount, ',d'))"
    )

    # Define the bar mark
    bars = base.mark_bar(size=45).encode(
        x=alt.X('label:N', sort=df['label'].tolist(), title='Category', axis=alt.Axis(labelAngle=0)),
        y=alt.Y('y:Q', title='Amount'),
        y2=alt.Y2('y2:Q'),
        color=alt.Color('lead:N', scale=alt.Scale(
            domain=['Total', 'Increase', 'Decrease'],
            range=['#595959', '#2ca02c', '#d62728']
        ), legend=alt.Legend(title="Type")),
        tooltip=[
            alt.Tooltip('label:N', title='Category'),
            alt.Tooltip('amount:Q', title='Delta Amount', format=',d'),
            alt.Tooltip('cumsum:Q', title='Cumulative Total', format=',d')
        ]
    )

    # Define the text mark for displaying the step's delta amount / total
    text = base.mark_text(
        align='center',
        baseline='bottom',
        dy=-8,  # Nudges text up slightly above the bar
        fontWeight='bold',
        fontSize=11,
        color='black'
    ).encode(
        x=alt.X('label:N', sort=df['label'].tolist()),
        y=alt.Y('text_y:Q'),
        text=alt.Text('label_text:N')
    )

    # Layer the bars and text labels together
    waterfall = alt.layer(bars, text).properties(
        width=600,
        height=400,
        title=alt.Title(
            text="Waterfall Chart of Sequential Cash-Flow Deltas",
            subtitle=["Visualizing steps from starting balance to ending balance", "Data source: cash_flow.csv"],
            anchor='start',
            fontSize=16,
            subtitleFontSize=12
        )
    ).configure_view(
        strokeWidth=0
    ).configure_axis(
        grid=True,
        gridDash=[3, 3]
    )

    # Save the chart as a standalone HTML file
    waterfall.save(html_path)
    print(f"Successfully generated waterfall chart and saved to {html_path}")

if __name__ == '__main__':
    main()
