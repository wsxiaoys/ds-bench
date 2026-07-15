"""Build a layered rolling-window stock chart with Vega-Altair.

Loads /home/user/altair-stocks/stocks.csv, builds one layered chart that
overlays each symbol's raw daily price (faint line) with a 30-day rolling
mean computed entirely via Altair's window transform, and saves a
self-contained offline HTML to /home/user/altair-stocks/chart.html.
"""

from pathlib import Path

import altair as alt
import pandas as pd


PROJECT_DIR = Path("/home/user/altair-stocks")
CSV_PATH = PROJECT_DIR / "stocks.csv"
HTML_PATH = PROJECT_DIR / "chart.html"


def load_data(csv_path: Path) -> pd.DataFrame:
    """Load daily stock prices from a local CSV."""
    df = pd.read_csv(csv_path, parse_dates=["date"])
    df = df.sort_values(["symbol", "date"]).reset_index(drop=True)
    return df


def build_chart(df: pd.DataFrame) -> alt.Chart:
    """Construct the layered rolling-mean chart."""
    # Brush-based pan/zoom selector on the x-axis.
    zoom = alt.selection_interval(bind="scales", encodings=["x"])

    # Raw daily price: faint line, colored by symbol.
    raw = (
        alt.Chart(df)
        .mark_line(opacity=0.25, strokeWidth=1)
        .encode(
            x=alt.X("date:T", title="Date"),
            y=alt.Y("price:Q", title="Price (USD)"),
            color=alt.Color("symbol:N", title="Symbol"),
            tooltip=[
                alt.Tooltip("date:T", title="Date"),
                alt.Tooltip("symbol:N", title="Symbol"),
                alt.Tooltip("price:Q", title="Price", format=".2f"),
            ],
        )
        .properties(title="Daily Closing Prices with 30-Day Rolling Mean")
    )

    # 30-day trailing rolling mean: computed inside the Vega-Lite spec.
    rolling = (
        alt.Chart(df)
        .transform_window(
            rolling_mean="mean(price)",
            frame=[-29, 0],
            groupby=["symbol"],
            sort=[{"field": "date", "order": "ascending"}],
        )
        .mark_line(strokeWidth=2.5)
        .encode(
            x="date:T",
            y=alt.Y("rolling_mean:Q", title="Price (USD)"),
            color=alt.Color("symbol:N", title="Symbol"),
            tooltip=[
                alt.Tooltip("date:T", title="Date"),
                alt.Tooltip("symbol:N", title="Symbol"),
                alt.Tooltip("rolling_mean:Q", title="30d Mean", format=".2f"),
            ],
        )
    )

    chart = (
        alt.layer(raw, rolling)
        .resolve_scale(color="shared", y="shared")
        .add_params(zoom)
        .interactive()
        .properties(width=900, height=450)
    )
    return chart


def main() -> None:
    df = load_data(CSV_PATH)
    chart = build_chart(df)
    # Save as a fully self-contained HTML file: the data is embedded inline
    # and the chart uses only the locally vendored Vega/Vega-Lite JS bundle.
    chart.save(
        str(HTML_PATH),
        format="html",
        inline=True,
        embed_options={"renderer": "canvas"},
    )
    print(f"Wrote {HTML_PATH} ({HTML_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
