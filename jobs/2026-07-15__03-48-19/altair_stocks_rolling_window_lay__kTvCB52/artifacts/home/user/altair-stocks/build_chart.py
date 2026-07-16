"""
Build a layered rolling-window stock chart with Vega-Altair.

Produces a single self-contained, offline HTML chart that overlays each
symbol's raw daily closing price (faint line) with a 30-day rolling mean
(smooth line). The rolling mean is computed entirely inside the
Vega-Lite specification via a window transform -- it is NOT pre-aggregated
in pandas.
"""

from pathlib import Path

import altair as alt
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR = Path("/home/user/altair-stocks")
CSV_PATH = PROJECT_DIR / "stocks.csv"
OUTPUT_PATH = PROJECT_DIR / "chart.html"

ROLLING_WINDOW = 30  # trailing 30-observation window (business days)

# ---------------------------------------------------------------------------
# 1. Load the local daily price data.
# ---------------------------------------------------------------------------
df = pd.read_csv(CSV_PATH)

# Ensure correct dtypes: keep date as an ISO string (JSON-serializable) and
# price as numeric. Vega-Lite parses `date:T` ISO strings into temporal values.
df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
df["price"] = pd.to_numeric(df["price"])

# Sort so the trailing window transform is well-defined per symbol.
df = df.sort_values(["symbol", "date"]).reset_index(drop=True)

# Use Altair's "csv" data transformer so the data is embedded inline in the
# resulting HTML (no external file/URL references).
alt.data_transformers.enable("default")

# ---------------------------------------------------------------------------
# 2. Build the layered chart.
# ---------------------------------------------------------------------------
# A common base with the data + the window transform that computes the
# 30-day rolling mean *inside the Vega-Lite spec*.
#
#   frame=[-29, 0]  -> a trailing window of the current row and the 29 rows
#                     before it (30 observations total).
#   groupby=['symbol'] -> compute the rolling mean independently per symbol.
#   [price]: mean  -> aggregate the `price` field with the mean operator.
#
base = alt.Chart(df).transform_window(
    rolling_mean="mean(price)",
    frame=[-(ROLLING_WINDOW - 1), 0],
    groupby=["symbol"],
)

# X axis shared by both layers.
x = alt.X("date:T", title="Date")
y = alt.Y("price:Q", title="Closing Price (USD)")

# Tooltip shared by both layers: date, symbol, and price.
tooltip = [
    alt.Tooltip("date:T", title="Date"),
    alt.Tooltip("symbol:N", title="Symbol"),
    alt.Tooltip("price:Q", title="Price", format="$.2f"),
]

# Layer 1 -- raw daily closing price, drawn faintly (low opacity, thin line).
raw_line = base.mark_line(opacity=0.25, strokeWidth=1).encode(
    x=x,
    y=y,
    color=alt.Color("symbol:N", title="Symbol"),
    tooltip=tooltip,
)

# Layer 2 -- 30-day rolling mean line, drawn boldly on top.
rolling_line = base.mark_line(opacity=1.0, strokeWidth=2.5).encode(
    x=x,
    y=alt.Y("rolling_mean:Q", title="Closing Price (USD)"),
    color=alt.Color("symbol:N", title="Symbol"),
    tooltip=[
        alt.Tooltip("date:T", title="Date"),
        alt.Tooltip("symbol:N", title="Symbol"),
        alt.Tooltip("rolling_mean:Q", title="30-day Rolling Mean", format="$.2f"),
    ],
)

# Overlay the two layers into a single chart and enable pan/zoom interactivity.
chart = (raw_line + rolling_line).properties(
    width=900,
    height=450,
    title="Daily Closing Price with 30-Day Rolling Mean",
).interactive()

# ---------------------------------------------------------------------------
# 3. Save as a fully offline, self-contained HTML file.
# ---------------------------------------------------------------------------
# `inline=True` makes Altair embed the vega-embed JavaScript bundle (via
# vl_convert) directly inside the HTML, so the file renders without any CDN
# or network dependency. The data is embedded inline as well.
chart.save(
    str(OUTPUT_PATH),
    format="html",
    inline=True,
    embed_options={"actions": True},
)

print(f"Saved offline chart to {OUTPUT_PATH}")
print(f"File size: {OUTPUT_PATH.stat().st_size:,} bytes")