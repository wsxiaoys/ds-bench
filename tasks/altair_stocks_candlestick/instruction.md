# Interactive Candlestick + Volume Chart with Vega-Altair

## Background
You are visualizing daily stock activity for a single ticker. A synthetic OHLCV dataset is already provided in the project directory as `ohlcv.csv` (columns: `date`, `open`, `high`, `low`, `close`, `volume`). Your task is to build an interactive, financially conventional candlestick visualization paired with a volume overview, all expressed declaratively with Vega-Altair.

## Requirements
- The project path is `/home/user/altair_stocks_candlestick`.
- Create a Python script named `build_chart.py` in the project directory.
- Read the OHLCV dataset from `ohlcv.csv`.
- Produce a vertically composed (vconcat) chart consisting of two views that share the `date` axis:
  - **Upper view (candlestick)**: a layered chart combining a high–low wick and an open–close body for each trading day. The body fill must be encoded by a per-row predicate comparing `open` and `close` so that up days (close ≥ open) and down days (close < open) get distinct colors.
  - **Lower view (volume)**: a bar chart of `volume` over `date` (encoded as temporal).
- The lower view must host an interval brush that is constrained to the `x` (date) encoding only. The upper view's x-axis domain must be bound to that brush so that brushing on the lower chart zooms / pans the candlestick chart.
- Save the chart as `chart.html` (a self-contained HTML file embedding the Vega-Lite spec via vega-embed) and `chart.json` (the Vega-Lite JSON specification of the composed chart) in the same directory.

## Implementation Hints
- Use a single Altair `Chart` base for the candlestick view and overlay a `mark_rule` (low–high wick) with a `mark_bar` (open–close body) via layering. The wick uses `y` / `y2` of `low` / `high`; the body uses `y` / `y2` of `open` / `close`.
- Encode the bullish/bearish coloring with a conditional value definition driven by a predicate on `datum.open` and `datum.close` (e.g. `alt.condition` or `alt.when`), choosing a green for up days and a red for down days.
- Define an `alt.selection_interval(encodings=['x'])` parameter, attach it to the lower volume chart with `add_params`, and reference it from the upper chart's x scale `domain` so brushing controls the focus.
- Compose the two charts with vertical concatenation (`&` / `alt.vconcat`).
- Persist the chart via `chart.save('chart.html')` and `chart.save('chart.json')` (or equivalent) so both artifacts exist on disk.

