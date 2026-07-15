"""
build_bump_chart.py
-------------------
Generates a bump chart that tracks product-line rankings across quarterly
reporting periods using Vega-Altair.

Rankings are computed declaratively inside the chart spec via Altair's
window transform (rank() sorted by sales descending, grouped by period).
The finished chart is exported as a self-contained HTML file.
"""

import altair as alt
import pandas as pd

# ── 1. Load data ─────────────────────────────────────────────────────────────
df = pd.read_csv("data/product_sales.csv")

# ── 2. Base chart: shared data + window transform + encodings ─────────────────
base = (
    alt.Chart(df)
    .transform_window(
        rank="rank()",
        sort=[alt.SortField("sales", order="descending")],
        groupby=["period"],
    )
    .encode(
        x=alt.X(
            "period:O",
            axis=alt.Axis(title="Reporting Period", labelAngle=-30),
        ),
        y=alt.Y(
            "rank:Q",
            scale=alt.Scale(reverse=True),
            axis=alt.Axis(
                title="Rank",
                tickMinStep=1,
                values=list(range(1, df["category"].nunique() + 1)),
            ),
        ),
        color=alt.Color(
            "category:N",
            legend=alt.Legend(title="Product Line"),
        ),
        tooltip=[
            alt.Tooltip("category:N", title="Product Line"),
            alt.Tooltip("period:O",   title="Period"),
            alt.Tooltip("rank:Q",     title="Rank"),
            alt.Tooltip("sales:Q",    title="Sales"),
        ],
    )
)

# ── 3. Layer: lines (connections) + points (markers) ─────────────────────────
lines = base.mark_line(strokeWidth=2.5)
points = base.mark_point(filled=True, size=120)

chart = (
    alt.layer(lines, points)
    .properties(
        title=alt.TitleParams(
            text="Product Line Rankings by Quarter",
            subtitle="Rank 1 = highest sales in that period",
            fontSize=18,
            subtitleFontSize=13,
        ),
        width=600,
        height=350,
    )
    .configure_view(strokeWidth=0)
    .configure_axis(grid=True, gridOpacity=0.3)
)

# ── 4. Export as self-contained HTML (all data + runtime embedded inline) ─────
chart.save("chart.html", embed_options={"renderer": "svg"})
print("chart.html written successfully.")
