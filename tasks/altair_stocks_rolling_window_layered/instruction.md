# Layered Rolling-Window Stock Chart with Vega-Altair

## Background
You are building an interactive time-series visualization for a small equities dashboard using the Vega-Altair Python library. A local CSV of daily closing prices for three stock symbols is already provided in the environment. You must produce a single, self-contained HTML chart that overlays each symbol's raw daily price with a smoothed 30-day rolling mean, where the rolling mean is computed entirely inside the Altair/Vega-Lite specification (not pre-aggregated in pandas).

## Requirements
- Load the daily price data from the provided local CSV file.
- Build ONE layered chart that, for every symbol, shows:
  - the raw daily closing price as a faint/light line, and
  - a 30-day rolling mean line computed with Altair's window transform.
- Color both layers by symbol so that a legend distinguishes the three symbols.
- Add tooltips that expose the date, symbol, and price.
- Enable interactive panning and zooming.
- Save the result as a self-contained, offline HTML file that renders without any external/CDN or network dependency.

## Implementation Hints
- Project path: /home/user/altair-stocks
- Input data: /home/user/altair-stocks/stocks.csv (columns: `date`, `symbol`, `price`; three symbols; daily business-day frequency). Do NOT fetch any remote dataset or URL — use only this local file so the produced chart embeds the data inline.
- Compute the rolling mean with `transform_window`, using the `frame` parameter over a trailing 30-observation window and `groupby` on the symbol, aggregating `price` with `mean`.
- Overlay the raw price line and the rolling-mean line using layering, and render the raw price line with reduced opacity so it appears lighter than the rolling-mean line.
- Enable pan/zoom by making the chart interactive.
- Produce a fully offline, standalone HTML file so it renders without an internet connection.
- Output file: /home/user/altair-stocks/chart.html
- Ensure your script is actually executed so that the output HTML artifact exists at the path above.

