"""Interactive candlestick + volume chart for a single ticker.

Reads the OHLCV dataset from ``ohlcv.csv`` and produces a vertically
composed, interactive Vega-Altair chart with:

* an upper candlestick view (high/low wick + open/close body, with
  bullish / bearish coloring driven by a per-row predicate), and
* a lower volume bar view that hosts an x-only interval brush used to
  drive the candlestick's x-domain focus.

The composed chart is persisted to ``chart.html`` (self-contained, via
vega-embed) and ``chart.json`` (the Vega-Lite specification).
"""

from __future__ import annotations

import os

import altair as alt
import pandas as pd


# Resolve project directory (the directory that holds this script).
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(PROJECT_DIR, "ohlcv.csv")
HTML_PATH = os.path.join(PROJECT_DIR, "chart.html")
JSON_PATH = os.path.join(PROJECT_DIR, "chart.json")


def load_ohlcv(csv_path: str) -> pd.DataFrame:
    """Load the OHLCV dataset and ensure ``date`` is parsed as datetime."""
    df = pd.read_csv(csv_path)
    df["date"] = pd.to_datetime(df["date"])
    return df


def build_chart(df: pd.DataFrame) -> alt.VConcatChart:
    """Build the vertically composed candlestick + volume chart."""
    # Per-row predicate: up day when close >= open, down day otherwise.
    # The conditional value definition is driven by a predicate on
    # ``datum.open`` and ``datum.close`` so bullish / bearish days get
    # distinct colors on both the wick and the body.
    up_down_color = alt.condition(
        "datum.open <= datum.close",
        alt.value("#26a69a"),  # bullish / up day
        alt.value("#ef5350"),  # bearish / down day
    )

    # Interval brush constrained to the x (date) encoding.  It is
    # attached to the lower volume chart and used to drive the upper
    # candlestick's x-scale domain.
    brush = alt.selection_interval(encodings=["x"], name="brush")

    # ---- Upper view: candlestick (wick + body) ----------------------
    x_enc = alt.X(
        "date:T",
        title="Date",
        scale=alt.Scale(domain=alt.param(brush)),
        axis=alt.Axis(format="%b %d"),
    )

    base = alt.Chart(df).encode(x=x_enc)

    wick = base.mark_rule().encode(
        y=alt.Y("low:Q", title="Price", scale=alt.Scale(zero=False)),
        y2="high:Q",
        color=up_down_color,
        tooltip=[
            alt.Tooltip("date:T", title="Date"),
            alt.Tooltip("open:Q"),
            alt.Tooltip("high:Q"),
            alt.Tooltip("low:Q"),
            alt.Tooltip("close:Q"),
        ],
    )

    body = base.mark_bar(size=10).encode(
        y=alt.Y("open:Q", title="Price"),
        y2="close:Q",
        color=up_down_color,
        tooltip=[
            alt.Tooltip("date:T", title="Date"),
            alt.Tooltip("open:Q"),
            alt.Tooltip("close:Q"),
        ],
    )

    candlestick = alt.layer(wick, body).properties(
        title="OHLC Candlestick",
        height=400,
    )

    # ---- Lower view: volume bars with the brush selection -----------
    volume = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X("date:T", title="Date", axis=alt.Axis(format="%b %d")),
            y=alt.Y("volume:Q", title="Volume"),
            color=up_down_color,
            tooltip=[
                alt.Tooltip("date:T", title="Date"),
                alt.Tooltip("volume:Q", title="Volume"),
            ],
        )
        .add_params(brush)
        .properties(title="Volume", height=120)
    )

    # ---- Vertical composition ---------------------------------------
    chart = alt.vconcat(
        candlestick,
        volume,
        spacing=5,
        title="Interactive Candlestick + Volume",
    ).resolve_scale(x="independent")

    return chart


def main() -> None:
    df = load_ohlcv(CSV_PATH)
    chart = build_chart(df)

    # ``save`` writes the self-contained HTML (with vega-embed) and the
    # raw Vega-Lite JSON spec, as required.
    chart.save(HTML_PATH)
    chart.save(JSON_PATH)

    print(f"Wrote {HTML_PATH}")
    print(f"Wrote {JSON_PATH}")


if __name__ == "__main__":
    main()
