"""Build a bump chart of category rankings over time with Vega-Altair.

The ranking is computed declaratively inside the chart specification using an
Altair window transform (`op='rank'`), then exported as a self-contained HTML
file that embeds all data locally.
"""

import pathlib

import altair as alt
import pandas as pd

PROJECT_DIR = pathlib.Path(__file__).resolve().parent
DATA_PATH = PROJECT_DIR / "data" / "product_sales.csv"
OUTPUT_PATH = PROJECT_DIR / "chart.html"


def load_sales() -> pd.DataFrame:
    """Load the bundled quarterly product sales CSV."""
    df = pd.read_csv(DATA_PATH)
    # Ensure the period is treated as an ordered categorical so the x axis
    # follows the chronological order (Q1 2023, Q2 2023, ... Q2 2024).
    df["period"] = pd.Categorical(df["period"], categories=sorted(df["period"].unique()), ordered=True)
    return df


def build_bump_chart(df: pd.DataFrame) -> alt.LayerChart:
    """Compose the layered bump chart (line + point) over a shared base."""
    # Shared base: same data, same window transform, same encodings.
    base = (
        alt.Chart(df)
        # Window transform: rank rows by sales (descending) within each period.
        # The result is a new field literally named "rank".
        .transform_window(
            rank="rank(sales)",
            sort=[alt.SortField("sales", order="descending")],
            groupby=["period"],
        )
        .encode(
            x=alt.X("period:N", title="Reporting period"),
            y=alt.Y(
                "rank:O",
                # Reverse the y scale so rank 1 sits at the top of the chart.
                scale=alt.Scale(reverse=True),
                title="Rank (1 = highest sales)",
                axis=alt.Axis(format="d"),
            ),
            color=alt.Color("category:N", title="Product line"),
            tooltip=[
                alt.Tooltip("category:N", title="Product line"),
                alt.Tooltip("period:N", title="Period"),
                alt.Tooltip("rank:Q", title="Rank"),
                alt.Tooltip("sales:Q", title="Sales", format=","),
            ],
        )
    )

    line = base.mark_line(size=2)
    points = base.mark_point(size=80, filled=True)

    return alt.layer(line, points).properties(
        title="Bump chart: rank of product lines by quarterly sales",
        width=640,
        height=420,
    )


def main() -> None:
    df = load_sales()
    chart = build_bump_chart(df)
    # Save as a self-contained standalone HTML document.
    chart.save(str(OUTPUT_PATH))
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
