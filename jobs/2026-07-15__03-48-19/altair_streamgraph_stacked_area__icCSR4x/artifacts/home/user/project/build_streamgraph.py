"""Build a streamgraph from the local weekly category-volume dataset.

Usage (from the project directory):

    python3 build_streamgraph.py

Produces a standalone HTML artifact: streamgraph.html
"""

from pathlib import Path

import altair as alt
import pandas as pd

PROJECT_DIR = Path(__file__).resolve().parent
DATA_PATH = PROJECT_DIR / "data" / "category_volume.csv"
OUTPUT_PATH = PROJECT_DIR / "streamgraph.html"


def build_chart() -> alt.Chart:
    # Read the raw weekly data; aggregation is performed declaratively
    # inside the Vega-Lite spec (no pandas groupby).
    df = pd.read_csv(DATA_PATH)

    chart = (
        alt.Chart(df)
        .mark_area()
        .encode(
            x=alt.X(
                "date:T",
                timeUnit="yearmonth",
                axis=alt.Axis(format="%Y", title="Month"),
            ),
            y=alt.Y(
                "volume:Q",
                aggregate="sum",
                stack="center",
                axis=None,
                title="Volume",
            ),
            color=alt.Color(
                "category:N",
                scale=alt.Scale(scheme="tableau20"),
                legend=alt.Legend(title="Category"),
            ),
            tooltip=[
                alt.Tooltip("category:N", title="Category"),
                alt.Tooltip("date:T", timeUnit="yearmonth", title="Month"),
                alt.Tooltip("volume:Q", aggregate="sum", title="Volume"),
            ],
        )
        # Report-friendly theming.
        .configure_axis(
            grid=False,
            labelFontSize=12,
            titleFontSize=14,
        )
        .configure_view(
            stroke=None,
        )
        # Enable interactive zoom/pan (binds a parameter to the scales).
        .interactive()
    )

    return chart


def main() -> None:
    chart = build_chart()
    chart.save(str(OUTPUT_PATH))
    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()