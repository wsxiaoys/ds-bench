#!/usr/bin/env python3
"""Generate a layered LOESS + Regression Trend chart with R² annotation."""

import json
import os

import altair as alt
import pandas as pd
import vl_convert as vlc

# --- Paths ---
DATA_PATH = "/home/user/altair_chart/data/marketing.csv"
OUTPUT_DIR = "/home/user/altair_chart/output"
OUTPUT_HTML = os.path.join(OUTPUT_DIR, "chart.html")
LOG_PATH = "/home/user/altair_chart/run.log"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Read data ---
df = pd.read_csv(DATA_PATH)

# --- Layer 1: Raw scatter points ---
points = alt.Chart(df).mark_circle(opacity=0.6).encode(
    x=alt.X("spend:Q", title="Advertising Spend"),
    y=alt.Y("sales:Q", title="Sales"),
    color=alt.Color("region:N", title="Region"),
    tooltip=["spend:Q", "sales:Q", "region:N"],
)

# --- Layer 2: LOESS smoothing line (solid) ---
loess = alt.Chart(df).transform_loess(
    "spend", "sales", groupby=["region"]
).mark_line(
    strokeWidth=3
).encode(
    x="spend:Q",
    y="sales:Q",
    color=alt.Color("region:N", legend=None),
)

# --- Layer 3: Linear regression trend line (dashed) ---
reg_line = alt.Chart(df).transform_regression(
    "spend", "sales", groupby=["region"], method="linear"
).mark_line(
    strokeDash=[8, 4],
    strokeWidth=2
).encode(
    x="spend:Q",
    y="sales:Q",
    color=alt.Color("region:N", legend=None),
)

# --- Layer 4: R² text annotation ---
# transform_regression with params=True outputs one row per group containing
# the regression coefficients (coef array), rSquared, etc.
# We then use transform_calculate to:
#   1. Format the R² label as "R² = 0.xx"
#   2. Compute a fixed x position near the right edge of the plot
#   3. Compute the predicted y at that x using the regression coefficients
r2_text = alt.Chart(df).transform_regression(
    "spend", "sales", groupby=["region"], method="linear", params=True
).transform_calculate(
    r2_label='"R² = " + format(datum.rSquared, ".2f")',
    x_pos="95",
    y_pos="datum.coef[0] + datum.coef[1] * 95",
).mark_text(
    dx=8,
    dy=-8,
    fontSize=12,
    fontWeight="bold",
).encode(
    x="x_pos:Q",
    y="y_pos:Q",
    text="r2_label:N",
    color=alt.Color("region:N", legend=None),
)

# --- Combine layers ---
chart = (points + loess + reg_line + r2_text).properties(
    width=700,
    height=450,
    title="Advertising Spend vs. Sales by Region (LOESS vs. Linear Regression)",
)

# --- Save as standalone HTML with data embedded inline ---
# Use vl_convert with bundle=True so that the Vega, Vega-Lite, and
# Vega-Embed JavaScript libraries are embedded directly in the HTML.
# This makes the file render fully offline (no CDN / network access).
spec_json = chart.to_json()
html_content = vlc.vegalite_to_html(spec_json, bundle=True)
with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(html_content)

# --- Write log ---
with open(LOG_PATH, "w") as f:
    f.write("Chart saved: /home/user/altair_chart/output/chart.html\n")

print(f"Chart saved to {OUTPUT_HTML}")
print(f"Log written to {LOG_PATH}")