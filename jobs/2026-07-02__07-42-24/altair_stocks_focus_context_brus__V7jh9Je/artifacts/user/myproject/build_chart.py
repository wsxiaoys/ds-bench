import altair as alt
from vega_datasets import data

def build_chart():
    # Load S&P 500 dataset URL
    source_url = data.sp500.url

    # Define a single Vega-Altair selection: an interval brush limited to the x (time) axis
    brush = alt.selection_interval(encodings=['x'])

    # Build a shared base chart whose encodings can be reused
    base = alt.Chart(source_url).mark_area().encode(
        x='date:T',
        y='price:Q'
    )

    # Upper detail (focus) view:
    # - mark_area (inherited from base)
    # - x encoded as date:T with scale domain bound to the brush selection
    # - y encoded as price:Q (inherited from base)
    # - width 600, height 250
    upper = base.encode(
        x=alt.X('date:T', scale=alt.Scale(domain=brush))
    ).properties(
        width=600,
        height=250
    )

    # Lower overview (context) view:
    # - Same mark_area over the same data (date:T -> price:Q) (inherited from base)
    # - width 600, height 70
    # - brush selection attached to this view via add_params
    lower = base.properties(
        width=600,
        height=70
    ).add_params(
        brush
    )

    # Combine the two views vertically with focus on top and context on bottom
    chart = alt.vconcat(upper, lower)

    # Save the resulting compound chart as a single self-contained HTML file
    output_path = '/home/user/myproject/chart.html'
    chart.save(output_path)
    print(f"Chart successfully saved to {output_path}")

if __name__ == '__main__':
    build_chart()
