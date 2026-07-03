import pandas as pd
import altair as alt

def build_chart():
    # 1. Load the OHLCV dataset
    csv_path = '/home/user/altair_stocks_candlestick/ohlcv.csv'
    df = pd.read_csv(csv_path)
    df['date'] = pd.to_datetime(df['date'])

    # 2. Define the interval brush for the lower chart (volume)
    brush = alt.selection_interval(encodings=['x'])

    # 3. Define the color condition for bullish (up) vs bearish (down) days
    # Up days (close >= open) get green, down days (close < open) get red
    color_condition = alt.condition(
        "datum.close >= datum.open",
        alt.value("#06982d"),  # Green
        alt.value("#ae1325")   # Red
    )

    # 4. Construct the upper candlestick chart
    # Base chart defines the shared x-axis and the color condition
    # The x-axis scale domain is bound to the interval brush selection
    base = alt.Chart(df).encode(
        alt.X('date:T', scale=alt.Scale(domain=brush), title='Date'),
        color=color_condition
    )

    # Wick layer: low to high
    wick = base.mark_rule().encode(
        alt.Y('low:Q', scale=alt.Scale(zero=False), title='Price'),
        alt.Y2('high:Q')
    )

    # Body layer: open to close
    body = base.mark_bar().encode(
        alt.Y('open:Q'),
        alt.Y2('close:Q')
    )

    # Combine wick and body into the upper candlestick chart
    candlestick_chart = alt.layer(wick, body).properties(
        width=800,
        height=400,
        title='Stock Price Candlestick Chart'
    )

    # 5. Construct the lower volume chart
    # This chart hosts the interval brush and displays the full timeline
    volume_chart = alt.Chart(df).mark_bar(color='gray').encode(
        alt.X('date:T', title='Date'),
        alt.Y('volume:Q', title='Volume')
    ).add_params(
        brush
    ).properties(
        width=800,
        height=100,
        title='Volume Overview (Drag to zoom/pan the candlestick chart above)'
    )

    # 6. Vertically compose the two views
    composed_chart = alt.vconcat(candlestick_chart, volume_chart)

    # 7. Save the charts
    html_path = '/home/user/altair_stocks_candlestick/chart.html'
    json_path = '/home/user/altair_stocks_candlestick/chart.json'
    
    composed_chart.save(html_path)
    composed_chart.save(json_path)
    print(f"Successfully saved chart to {html_path} and {json_path}")

if __name__ == '__main__':
    build_chart()
