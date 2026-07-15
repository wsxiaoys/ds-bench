"""
build_streamgraph.py
--------------------
Reads the weekly category_volume.csv dataset, builds a streamgraph using
Altair (stacked area chart with center baseline), and writes a standalone
HTML file to streamgraph.html.

All aggregation (weekly → monthly) is performed declaratively inside the
Vega-Lite spec via the `yearmonth` time unit and `sum` aggregate — no
pandas groupby required.
"""

import altair as alt
import pandas as pd
import pathlib

# ── 1. Load data ────────────────────────────────────────────────────────────
DATA_PATH = pathlib.Path(__file__).parent / "data" / "category_volume.csv"
OUTPUT_PATH = pathlib.Path(__file__).parent / "streamgraph.html"

df = pd.read_csv(DATA_PATH, parse_dates=["date"])

# ── 2. Build the streamgraph spec ───────────────────────────────────────────
chart = (
    alt.Chart(df)
    .mark_area()
    .encode(
        # X: roll weekly dates up to year-month; show only the year on the axis
        x=alt.X(
            "date:T",
            timeUnit="yearmonth",
            title="Month",
            axis=alt.Axis(format="%Y", labelFontSize=12, titleFontSize=14),
        ),
        # Y: sum volume per (month, category); center-stack = streamgraph shape
        y=alt.Y(
            "sum(volume):Q",
            stack="center",
            axis=None,           # hide y-axis (hard requirement)
            title="Volume",
        ),
        # Color: categorical scheme for clean multi-category distinction
        color=alt.Color(
            "category:N",
            scale=alt.Scale(scheme="tableau20"),
            legend=alt.Legend(title="Category"),
        ),
        # Tooltip: category, month, and aggregated volume
        tooltip=[
            alt.Tooltip("category:N", title="Category"),
            alt.Tooltip("date:T", timeUnit="yearmonth", title="Month", format="%b %Y"),
            alt.Tooltip("sum(volume):Q", title="Volume"),
        ],
    )
    # Zoom / pan on x-scale via an interval selection bound to the scales
    .interactive()
    # ── 3. Theme / configuration ─────────────────────────────────────────────
    .configure_axis(
        grid=False,
        labelFontSize=12,
        titleFontSize=14,
    )
    .configure_view(
        stroke=None,    # remove outer border
    )
    .properties(
        title="Monthly Transaction Volume by Category",
        width=900,
        height=420,
    )
)

# ── 4. Export to standalone HTML ────────────────────────────────────────────
chart.save(str(OUTPUT_PATH))
print(f"Streamgraph written to: {OUTPUT_PATH}")
