"""
Build a slope graph comparing regional revenue across 2023 and 2024
using Vega-Altair.

The chart is a layered composition of three marks:
  1. line  — one line segment per region connecting its 2023 and 2024 revenue.
  2. point — a circle at each endpoint of every region's line.
  3. text  — the revenue value labelled at each endpoint.

Lines and points are coloured by whether the region's revenue increased
or decreased from 2023 to 2024.  This up/down classification is derived
*inside* the chart specification with a ``calculate`` transform — it is
NOT pre-computed in the CSV or as a pandas column.

A ``fold`` transform reshapes the wide year-columns into two x-positions
(the two years) while the original year columns remain available for the
trend ``calculate`` transform (which runs *before* the fold).  A
``detail`` encoding on ``region`` ensures each region renders as its own
line rather than one connected path per colour group.

The data is embedded inline in the resulting spec (no http/https URLs).
"""

import altair as alt
import pandas as pd

# Ensure data is always embedded inline regardless of row count.
alt.data_transformers.disable_max_rows()

# --- Load the local data ----------------------------------------------------
CSV_PATH = "/home/user/project/data/regional_revenue.csv"
df = pd.read_csv(CSV_PATH)

# --- Shared base with transforms --------------------------------------------
# 1. calculate: derive the trend ("Increase" / "Decrease") from the two
#    original year columns — computed BEFORE the fold so both columns are
#    still present on every row.
# 2. fold: reshape the two year-columns into a long format producing a
#    `year_key` field ("revenue_2023" / "revenue_2024") and a `revenue`
#    value field — this gives us the two x-positions.
# 3. calculate: turn the folded key into a clean year label ("2023"/"2024").
base = alt.Chart(df).transform_calculate(
    trend='datum.revenue_2024 > datum.revenue_2023 ? "Increase" : "Decrease"'
).transform_fold(
    ["revenue_2023", "revenue_2024"],
    as_=["year_key", "revenue"],
).transform_calculate(
    year='datum.year_key === "revenue_2023" ? "2023" : "2024"',
)

# Colour scale: green for increase, red for decrease.
trend_color = alt.Color(
    "trend:N",
    title="Trend",
    scale=alt.Scale(
        domain=["Increase", "Decrease"],
        range=["#2ca02c", "#d62728"],
    ),
)

# Common x / y encodings reused across layers.
x_enc = alt.X("year:O", title="Year", sort=["2023", "2024"])
y_enc = alt.Y("revenue:Q", title="Revenue")

# --- Layer 1: line ---------------------------------------------------------
# `detail` on region keeps each region as its own line segment even when
# several regions share the same trend colour.
line = base.mark_line().encode(
    x=x_enc,
    y=y_enc,
    color=trend_color,
    detail="region:N",
)

# --- Layer 2: points at both endpoints -------------------------------------
points = base.mark_circle(size=90).encode(
    x=x_enc,
    y=y_enc,
    color=trend_color,
    detail="region:N",
)

# --- Layer 3: text labels at both endpoints --------------------------------
text = base.mark_text(
    align="center",
    baseline="middle",
    dy=-12,          # nudge label above the point
    fontSize=11,
    fontWeight="bold",
).encode(
    x=x_enc,
    y=y_enc,
    text="revenue:Q",
    color=trend_color,
    detail="region:N",
)

# --- Combine into a single layered chart ----------------------------------
chart = (line + points + text).properties(
    title="Regional Revenue: 2023 vs 2024",
    width=650,
    height=450,
)

# --- Save as a self-contained standalone HTML page -------------------------
OUTPUT_PATH = "/home/user/project/slope_graph.html"
chart.save(OUTPUT_PATH)

print(f"Saved slope graph to {OUTPUT_PATH}")