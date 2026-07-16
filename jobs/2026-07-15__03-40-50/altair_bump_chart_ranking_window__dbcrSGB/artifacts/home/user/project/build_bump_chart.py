import pandas as pd
import altair as alt

def build_chart():
    # 1. Load the bundled local dataset of quarterly product sales
    data_path = '/home/user/project/data/product_sales.csv'
    df = pd.read_csv(data_path)

    # 2. Build the bump chart
    # We use a shared base chart that defines the dataset and the window transform
    # The window transform computes rank() sorted by sales descending, partitioned by period
    base = alt.Chart(df).transform_window(
        rank='rank()',
        sort=[alt.SortField('sales', order='descending')],
        groupby=['period']
    ).encode(
        x=alt.X('period:O', title='Reporting Period'),
        y=alt.Y('rank:Q', scale=alt.Scale(reverse=True), axis=alt.Axis(tickMinStep=1, values=[1, 2, 3, 4, 5]), title='Rank'),
        color=alt.Color('category:N', title='Product Line'),
        tooltip=[
            alt.Tooltip('category:N', title='Product Line'),
            alt.Tooltip('period:O', title='Period'),
            alt.Tooltip('rank:Q', title='Rank'),
            alt.Tooltip('sales:Q', title='Sales')
        ]
    )

    # 3. Create the line and point marks
    line = base.mark_line(strokeWidth=3)
    point = base.mark_point(size=120, filled=True)

    # 4. Combine into a layered chart and set properties
    chart = alt.layer(line, point).properties(
        width=700,
        height=450,
        title=alt.TitleParams(
            text="Category Sales Rankings Over Time",
            subtitle=["Quarterly ranking of product lines based on sales volume", "Rank 1 represents the highest sales"],
            anchor='start',
            fontSize=18,
            subtitleFontSize=12
        )
    ).configure_axis(
        labelFontSize=11,
        titleFontSize=12
    ).configure_legend(
        titleFontSize=12,
        labelFontSize=11
    )

    # 5. Save the finished chart to a self-contained HTML file
    output_path = '/home/user/project/chart.html'
    chart.save(output_path)
    print(f"Chart successfully saved to {output_path}")

if __name__ == '__main__':
    build_chart()
