"""Build a slope graph comparing regional revenue between 2023 and 2024.

The chart is a layered composition of three Altair marks (line, point, text)
operating on a long-form version of the wide two-year data. The up/down
classification is derived inside the spec via a `transform_calculate`.
"""

import os

import altair as alt
import pandas as pd


PROJECT_DIR = "/home/user/project"
DATA_PATH = os.path.join(PROJECT_DIR, "data", "regional_revenue.csv")
OUTPUT_PATH = os.path.join(PROJECT_DIR, "slope_graph.html")


def build_chart(df: pd.DataFrame) -> alt.Chart:
    """Construct the layered slope-graph chart.

    The chart uses three marks:
      * a line mark with a per-region `detail` encoding so each region
        renders as its own line segment,
      * a point mark at both endpoints,
      * a text mark labelling the revenue value at both endpoints.
    The color channel encodes the increase/decrease trend, which is
    derived inside the spec by a `transform_calculate` (it is *not*
    pre-computed as a column in the source data).
    """

    # Derive up vs. down *inside* the chart spec. The `trend` field
    # is computed from the original `revenue_2023` / `revenue_2024`
    # columns (those are still attached to each row because we fold
    # *after* the calculate transform, and a fold produces a copy of
    # the data with the new key/value pair, not a projection).
    base = (
        alt.Chart(df)
        .transform_calculate(
            trend=(
                "datum.revenue_2024 > datum.revenue_2023"
                " ? 'increase' : 'decrease'"
            ),
        )
        .transform_fold(
            fold=["revenue_2023", "revenue_2024"],
            as_=["year_column", "revenue"],
        )
    )

    color_scale = alt.Scale(
        domain=["increase", "decrease"],
        range=["#1f77b4", "#d62728"],
    )

    # 1. Line mark: one line per region, color encodes the trend.
    line = base.mark_line().encode(
        x=alt.X(
            "year_column:N",
            title="Year",
            sort=["revenue_2023", "revenue_2024"],
            axis=alt.Axis(
                labelExpr=(
                    "datum.value == 'revenue_2023' ? '2023' : '2024'"
                ),
            ),
        ),
        y=alt.Y("revenue:Q", title="Revenue"),
        color=alt.Color("trend:N", title="Trend", scale=color_scale),
        detail=alt.Detail("region:N"),
    )

    # 2. Point mark: a point at each endpoint, colored by the trend.
    point = base.mark_point(filled=True, size=80).encode(
        x="year_column:N",
        y="revenue:Q",
        color=alt.Color("trend:N", scale=color_scale),
    )

    # 3. Text mark: revenue value label at each endpoint. The 2023
    #    endpoint label sits to the left of its point and the 2024
    #    endpoint label sits to the right, which is the conventional
    #    layout for a slope graph.
    text = base.mark_text(
        fontSize=11,
        align=alt.expr(
            "datum.year_column == 'revenue_2024' ? 'left' : 'right'"
        ),
        dx=alt.expr(
            "datum.year_column == 'revenue_2024' ? 6 : -6"
        ),
    ).encode(
        x="year_column:N",
        y="revenue:Q",
        text=alt.Text("revenue:Q", format=".1f"),
        color=alt.Color("trend:N", scale=color_scale),
    )

    chart = (line + point + text).properties(
        title="Regional Revenue: 2023 vs 2024",
        width=420,
        height=360,
    )

    return chart


def main() -> None:
    df = pd.read_csv(DATA_PATH)
    chart = build_chart(df)
    chart.save(OUTPUT_PATH)
    print(f"Wrote slope graph to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
