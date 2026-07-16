import altair as alt
import pandas as pd

def main():
    # 1. Load the daily price data from the provided local CSV file
    csv_path = '/home/user/altair-stocks/stocks.csv'
    df = pd.read_csv(csv_path)
    
    # Parse date column as datetime
    df['date'] = pd.to_datetime(df['date'])
    
    # 2. Build the base chart with date on X and color mapped to symbol
    base = alt.Chart(df).encode(
        x=alt.X('date:T', title='Date'),
        color=alt.Color('symbol:N', title='Stock Symbol')
    )
    
    # 3. Create the raw daily closing price layer (faint/light line)
    raw_line = base.mark_line(
        opacity=0.3, 
        strokeWidth=1.0
    ).encode(
        y=alt.Y('price:Q', title='Price ($)'),
        tooltip=[
            alt.Tooltip('date:T', title='Date', format='%Y-%m-%d'),
            alt.Tooltip('symbol:N', title='Symbol'),
            alt.Tooltip('price:Q', title='Daily Price ($)', format='$.2f')
        ]
    )
    
    # 4. Create the 30-day rolling mean layer (bold line)
    # Using transform_window with trailing 30-observation window (frame=[-29, 0])
    # grouped by symbol and sorted by date.
    rolling_line = base.mark_line(
        strokeWidth=2.5,
        opacity=1.0
    ).transform_window(
        rolling_mean='mean(price)',
        frame=[-29, 0],
        groupby=['symbol'],
        sort=[alt.SortField('date', order='ascending')]
    ).encode(
        y=alt.Y('rolling_mean:Q', title='Price ($)'),
        tooltip=[
            alt.Tooltip('date:T', title='Date', format='%Y-%m-%d'),
            alt.Tooltip('symbol:N', title='Symbol'),
            alt.Tooltip('price:Q', title='Daily Price ($)', format='$.2f'),
            alt.Tooltip('rolling_mean:Q', title='30-Day SMA ($)', format='$.2f')
        ]
    )
    
    # 5. Layer the charts together
    chart = alt.layer(raw_line, rolling_line)
    
    # 6. Configure properties (title, subtitles, dimensions, and interactivity)
    chart = chart.properties(
        title=alt.TitleParams(
            text='Stock Price Trends: Daily Closing vs. 30-Day Rolling Mean',
            subtitle='Faint lines show raw daily closing prices; bold lines show the 30-day simple moving average (SMA)',
            anchor='start',
            fontSize=18,
            subtitleFontSize=12,
            offset=15
        ),
        width=850,
        height=450
    ).interactive()
    
    # 7. Save the result as a self-contained, offline HTML file (inline=True)
    output_path = '/home/user/altair-stocks/chart.html'
    chart.save(output_path, inline=True)
    print(f"Successfully generated self-contained offline stock chart at: {output_path}")

if __name__ == '__main__':
    main()
