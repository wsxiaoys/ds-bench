"""Build a streamgraph of category volume over time using Vega-Altair.

This script reads the local weekly transaction volume dataset, declaratively
aggregates it to monthly resolution inside the Vega-Lite spec, and exports a
standalone HTML streamgraph.
"""

from pathlib import Path

import altair as alt


PROJECT_DIR = Path(__file__).resolve().parent
DATA_PATH = PROJECT_DIR / "data" / "category_volume.csv"
OUTPUT_PATH = PROJECT_DIR / "streamgraph.html"


def build_streamgraph() -> alt.Chart:
    """Construct the streamgraph chart specification.

    The raw weekly rows are rolled up to a monthly resolution declaratively
    inside the Vega-Lite spec via the ``yearmonth`` time unit and the ``sum``
    aggregate on ``volume``. The y encoding's stack mode is set to ``"center"``
    to wiggle the baseline to the middle of the plot, producing the
    streamgraph shape.
    """
    source = str(DATA_PATH)

    chart = (
        alt.Chart(source)
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
        .properties(
            title="Monthly Category Volume Streamgraph",
            width=900,
            height=450,
        )
        .interactive()
    )

    return chart


def apply_theme(chart: alt.Chart) -> alt.Chart:
    """Apply a report-friendly axis and view configuration."""
    return (
        chart.configure_axis(
            grid=False,
            labelFontSize=12,
            titleFontSize=14,
        )
        .configure_view(stroke=None)
    )


def main() -> None:
    chart = build_streamgraph()
    chart = apply_theme(chart)
    chart.save(str(OUTPUT_PATH), format="html")


if __name__ == "__main__":
    main()