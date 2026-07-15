"""
Build a layered, interactive Vega-Altair stock chart that:
  - Loads daily closing prices from stocks.csv
  - Shows raw price (faint) + 30-day rolling mean (bold) per symbol
  - Computes the rolling mean entirely via Altair's window transform
  - Saves a fully self-contained, offline HTML file
"""

import pandas as pd
import altair as alt
from pathlib import Path

# ── 1. Load data ─────────────────────────────────────────────────────────────
HERE = Path(__file__).parent
csv_path = HERE / "stocks.csv"

df = pd.read_csv(csv_path, parse_dates=["date"])
df = df.sort_values(["symbol", "date"]).reset_index(drop=True)

# Altair needs the date as an ISO string for temporal encoding when embedded
df["date"] = df["date"].dt.strftime("%Y-%m-%d")

print(f"Loaded {len(df)} rows, symbols: {df['symbol'].unique().tolist()}")

# ── 2. Base chart (shared data + encodings) ───────────────────────────────────
#
# We sort inside the spec so Vega-Lite guarantees correct window ordering.
# The window transform rolls over the trailing 30 observations per symbol.

base = (
    alt.Chart(df)
    .mark_line()
    .encode(
        x=alt.X(
            "date:T",
            title="Date",
            axis=alt.Axis(format="%b %Y", labelAngle=-45),
        ),
        color=alt.Color(
            "symbol:N",
            title="Symbol",
            scale=alt.Scale(scheme="tableau10"),
        ),
        tooltip=[
            alt.Tooltip("date:T", title="Date", format="%Y-%m-%d"),
            alt.Tooltip("symbol:N", title="Symbol"),
            alt.Tooltip("price:Q", title="Price", format="$.2f"),
        ],
    )
    .transform_filter(alt.datum.price != None)  # noqa: E711 – drop any NaNs
    .properties(width=900, height=450)
)

# ── 3. Raw-price layer (faint) ────────────────────────────────────────────────
raw_layer = base.mark_line(opacity=0.25, strokeWidth=1).encode(
    y=alt.Y("price:Q", title="Price (USD)")
)

# ── 4. Rolling-mean layer (bold) ─────────────────────────────────────────────
#
# transform_window parameters:
#   frame=[-29, 0]  → trailing window of 30 observations (current + 29 prior)
#   groupby         → restart the window at each symbol boundary
#   sort            → ensure chronological order within each group
rolling_layer = (
    base.mark_line(opacity=0.9, strokeWidth=2.5)
    .transform_window(
        rolling_mean="mean(price)",
        frame=[-29, 0],
        groupby=["symbol"],
        sort=[alt.SortField("date", order="ascending")],
    )
    .encode(
        y=alt.Y("rolling_mean:Q", title="Price (USD)"),
        tooltip=[
            alt.Tooltip("date:T", title="Date", format="%Y-%m-%d"),
            alt.Tooltip("symbol:N", title="Symbol"),
            alt.Tooltip("rolling_mean:Q", title="30-Day Avg", format="$.2f"),
        ],
    )
)

# ── 5. Compose & configure ────────────────────────────────────────────────────
chart = (
    alt.layer(raw_layer, rolling_layer)
    .resolve_scale(y="shared")
    .interactive()  # enables pan & zoom
    .properties(
        title=alt.TitleParams(
            text="Daily Closing Prices with 30-Day Rolling Mean",
            subtitle="Faint lines = raw price · Bold lines = 30-day rolling average",
            fontSize=18,
            subtitleFontSize=13,
            anchor="start",
        )
    )
    .configure_legend(
        orient="top-right",
        titleFontSize=13,
        labelFontSize=12,
    )
    .configure_axis(
        gridOpacity=0.3,
        labelFontSize=11,
        titleFontSize=12,
    )
    .configure_view(stroke=None)
)

# ── 6. Save as fully self-contained, offline HTML ─────────────────────────────
out_path = HERE / "chart.html"
chart.save(str(out_path), inline=True, embed_options={"renderer": "svg"})
print(f"Chart saved → {out_path}  ({out_path.stat().st_size:,} bytes)")
