import os
import altair as alt
from vega_datasets import data

def build_dashboard():
    # Use the URL form of the dataset
    source = data.sp500.url

    # Create an interval brush restricted to the x-axis (date)
    brush = alt.selection_interval(encodings=['x'], name='brush')

    # Upper detail chart: area chart of price vs date
    # Bind its x-axis domain to the brush selection
    detail_area = alt.Chart(source).mark_area(
        color='lightblue',
        opacity=0.6
    ).encode(
        x=alt.X('date:T', title='Date').scale(domain=brush),
        y=alt.Y('price:Q', title='S&P 500 Price')
    ).properties(
        width=800,
        height=400,
        title='S&P 500 Focus + Context Dashboard'
    )

    # Horizontal rule annotation for the running maximum price within the brushed window
    # Filter the data based on the brush, then aggregate to find the max price
    max_rule = alt.Chart(source).mark_rule(
        color='red',
        strokeDash=[4, 4],
        strokeWidth=2
    ).transform_filter(
        brush
    ).transform_aggregate(
        max_price='max(price)'
    ).encode(
        y='max_price:Q'
    )

    # Text label for the max price rule
    max_text = alt.Chart(source).mark_text(
        color='red',
        align='left',
        baseline='bottom',
        dx=10,
        dy=-5,
        fontSize=12,
        fontWeight='bold'
    ).transform_filter(
        brush
    ).transform_aggregate(
        max_price='max(price)'
    ).encode(
        y='max_price:Q',
        text=alt.Text('max_price:Q', format='.2f')
    )

    # Layer the area chart, the maximum rule, and the text label
    detail_chart = alt.layer(detail_area, max_rule, max_text)

    # Lower context chart: navigator area chart with the brush selection
    context_chart = alt.Chart(source).mark_area(
        color='lightgray',
        opacity=0.5
    ).encode(
        x=alt.X('date:T', title='Drag to select date range'),
        y=alt.Y('price:Q', title='', axis=None)
    ).properties(
        width=800,
        height=60
    ).add_params(
        brush
    )

    # Vertically concatenate the detail and context charts
    dashboard = detail_chart & context_chart

    # Ensure the output directory exists
    os.makedirs('/home/user/altair_project', exist_ok=True)
    
    # Save the chart as a self-contained HTML file
    output_path = '/home/user/altair_project/chart.html'
    dashboard.save(output_path)
    print(f"Chart successfully saved to {output_path}")

if __name__ == '__main__':
    build_dashboard()
