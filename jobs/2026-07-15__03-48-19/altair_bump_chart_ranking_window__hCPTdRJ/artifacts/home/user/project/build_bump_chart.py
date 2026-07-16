#!/usr/bin/env python3
"""Build a bump chart of category rankings over time using Vega-Altair.

The ranking is computed declaratively inside the chart specification via a
window transform (not pre-computed in pandas), and the final chart is exported
as a self-contained HTML file with all data embedded inline.
"""

from pathlib import Path

import altair as alt
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "product_sales.csv"
OUTPUT_PATH = BASE_DIR / "chart.html"


def build_chart() -> alt.LayerChart:
    """Construct the layered bump chart from the bundled CSV dataset."""
    source = pd.read_csv(DATA_PATH)

    # Shared base: data + window transform that computes the ranking.
    # For each reporting period, rank the product lines by sales descending
    # (highest sales = rank 1), outputting the result into a field named `rank`.
    base = (
        alt.Chart(source)
        .transform_window(
            rank="rank()",
            sort=[alt.SortField(field="sales", order="descending")],
            groupby=["period"],
        )
        .encode(
            x=alt.X("period:N", title="Reporting Period"),
            y=alt.Y("rank:Q", title="Rank", scale=alt.Scale(reverse=True)),
            color=alt.Color("category:N", title="Product Line"),
            tooltip=[
                alt.Tooltip("category:N", title="Product Line"),
                alt.Tooltip("period:N", title="Period"),
                alt.Tooltip("rank:Q", title="Rank"),
                alt.Tooltip("sales:Q", title="Sales"),
            ],
        )
    )

    # Layer a line mark (connecting series) and a point mark (markers).
    line = base.mark_line(strokeWidth=2)
    point = base.mark_point(size=100, filled=True)

    return (line + point).properties(
        title="Product Line Ranking Over Time",
        width=720,
        height=450,
    )


def main() -> None:
    chart = build_chart()
    # Save as a self-contained HTML document with all data embedded inline.
    chart.save(str(OUTPUT_PATH))
    print(f"Chart written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()