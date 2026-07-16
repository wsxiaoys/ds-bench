"""
Generate a layered Vega-Altair chart with:
  - Raw scatter points per region
  - LOESS smoothing line per region (solid)
  - Linear regression trend line per region (dashed)
  - R² annotation per region derived from regression params
The dataset is embedded inline in the Vega-Lite spec (no CSV reference or remote URLs).
"""

import math
import json
import pandas as pd
import altair as alt

# ── Load data ──────────────────────────────────────────────────────────────────
DATA_PATH = "/home/user/altair_chart/data/marketing.csv"
OUTPUT_HTML = "/home/user/altair_chart/output/chart.html"
LOG_PATH = "/home/user/altair_chart/run.log"

df = pd.read_csv(DATA_PATH)

# ── Pre-compute R² per region (for annotation placement & label) ───────────────
def compute_r2(group):
    """Compute OLS R² for a group (spend → sales)."""
    x = group["spend"].values
    y = group["sales"].values
    n = len(x)
    x_mean = sum(x) / n
    y_mean = sum(y) / n
    ss_tot = sum((yi - y_mean) ** 2 for yi in y)
    ss_res = sum(
        (yi - (sum((xi - x_mean) * (yi2 - y_mean) for xi, yi2 in zip(x, y))
               / sum((xi - x_mean) ** 2 for xi in x)) * (xi - x_mean) - y_mean) ** 2
        for xi, yi in zip(x, y)
    )
    # Use numpy-free but reliable formula
    cov_xy = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, y))
    var_x  = sum((xi - x_mean) ** 2 for xi in x)
    var_y  = ss_tot
    r2 = (cov_xy ** 2) / (var_x * var_y) if var_x * var_y != 0 else 0.0
    return round(r2, 2)

r2_by_region = {region: compute_r2(grp) for region, grp in df.groupby("region")}

# ── Build an annotation DataFrame: one row per region ─────────────────────────
# Place the label at the max spend value in each region for a clean anchor.
annotation_rows = []
for region, grp in df.groupby("region"):
    x_pos = grp["spend"].max()
    # Predict y at x_pos using the regression line
    x = grp["spend"].values
    y = grp["sales"].values
    x_mean = sum(x) / len(x)
    y_mean = sum(y) / len(y)
    slope  = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, y)) / \
             sum((xi - x_mean) ** 2 for xi in x)
    intercept = y_mean - slope * x_mean
    y_pos = slope * x_pos + intercept
    annotation_rows.append({
        "spend":  x_pos,
        "sales":  y_pos,
        "region": region,
        "label":  f"R\u00b2 = {r2_by_region[region]:.2f}",
    })

ann_df = pd.DataFrame(annotation_rows)

# ── Altair source objects (inline data via values) ─────────────────────────────
source     = alt.InlineData(values=df.to_dict(orient="records"))
source_ann = alt.InlineData(values=ann_df.to_dict(orient="records"))

color = alt.Color("region:N", title="Region")

# Layer 1 – raw scatter points
scatter = (
    alt.Chart(source)
    .mark_point(filled=True, opacity=0.5, size=60)
    .encode(
        x=alt.X("spend:Q", title="Advertising Spend"),
        y=alt.Y("sales:Q", title="Sales"),
        color=color,
        tooltip=["region:N", "spend:Q", "sales:Q"],
    )
)

# Layer 2 – LOESS smoothing line (solid)
loess_line = (
    alt.Chart(source)
    .transform_loess("spend", "sales", groupby=["region"], bandwidth=0.4)
    .mark_line(strokeWidth=2.5)
    .encode(
        x=alt.X("spend:Q"),
        y=alt.Y("sales:Q"),
        color=color,
    )
)

# Layer 3 – Linear regression trend line (dashed)
reg_line = (
    alt.Chart(source)
    .transform_regression(
        "spend", "sales",
        groupby=["region"],
        method="linear",
    )
    .mark_line(strokeDash=[6, 3], strokeWidth=2, opacity=0.9)
    .encode(
        x=alt.X("spend:Q"),
        y=alt.Y("sales:Q"),
        color=color,
    )
)

# Layer 4 – R² annotation text (pre-computed, one label per region)
annotation = (
    alt.Chart(source_ann)
    .mark_text(align="right", dy=-8, fontSize=11, fontWeight="bold")
    .encode(
        x=alt.X("spend:Q"),
        y=alt.Y("sales:Q"),
        color=color,
        text=alt.Text("label:N"),
        tooltip=alt.value(None),
    )
)

# ── Compose the layered chart ──────────────────────────────────────────────────
chart = (
    alt.layer(scatter, loess_line, reg_line, annotation)
    .properties(
        title="Advertising Spend vs. Sales by Region",
        width=600,
        height=420,
    )
    .resolve_scale(color="shared")
)

# ── Save as fully self-contained HTML (no CDN, data embedded inline) ───────────
# inline=True bundles the vega/vega-lite/vega-embed JS inside the file so
# the chart renders without any network access.
chart.save(OUTPUT_HTML, inline=True)

# ── Write log ─────────────────────────────────────────────────────────────────
with open(LOG_PATH, "w") as fh:
    fh.write(f"Chart saved: {OUTPUT_HTML}\n")

print(f"Done. Output: {OUTPUT_HTML}")
print(f"Log:  {LOG_PATH}")
print(f"R² values: {r2_by_region}")
