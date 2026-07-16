"""Build a publication-quality, layered confidence-interval chart with Vega-Altair.

The script reads a local CSV file with columns ``group`` and ``response``,
constructs a single layered Altair chart that overlays:

    1. individual raw observations, horizontally jittered so overlapping
       points are visible,
    2. the per-group mean, drawn as a prominent point marker, and
    3. a 95% bootstrapped confidence interval of the mean per group.

The composed chart is written to ``output/chart.html`` as a standalone,
self-contained HTML document (data is embedded, no external references).
"""

from __future__ import annotations

import os

import altair as alt
import pandas as pd


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_DIR = "/home/user/altair-task"
DATA_PATH = os.path.join(PROJECT_DIR, "data", "measurements.csv")
OUTPUT_PATH = os.path.join(PROJECT_DIR, "output", "chart.html")


# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
df = pd.read_csv(DATA_PATH)

# Force a stable category order so the x-axis is always A, B, C, D.
GROUP_ORDER = ["A", "B", "C", "D"]
df["group"] = pd.Categorical(df["group"], categories=GROUP_ORDER, ordered=True)


# ---------------------------------------------------------------------------
# Layer 1: raw observations, horizontally jittered
# ---------------------------------------------------------------------------
# A calculated field that draws a fresh uniform random number per row drives
# an ``xOffset`` encoding channel, which scatters the points within each
# categorical group so overlaps become visible.
raw_points = (
    alt.Chart(df)
    .transform_calculate(
        jitter="random()",
    )
    .mark_point(
        size=60,
        opacity=0.45,
        color="#4c78a8",
        filled=True,
    )
    .encode(
        x=alt.X(
            "group:N",
            title="Treatment group",
            axis=alt.Axis(labelAngle=0, labelFontSize=12, titleFontSize=13),
            scale=alt.Scale(domain=GROUP_ORDER),
        ),
        xOffset=alt.XOffset(
            "jitter:Q",
            scale=alt.Scale(range=[-1, 1]),
            title=None,
        ),
        y=alt.Y(
            "response:Q",
            title="Measured response",
            axis=alt.Axis(labelFontSize=11, titleFontSize=13),
        ),
        tooltip=[
            alt.Tooltip("group:N", title="Group"),
            alt.Tooltip("response:Q", title="Response", format=".3f"),
        ],
    )
)


# ---------------------------------------------------------------------------
# Layer 2: per-group mean, drawn as a prominent diamond marker
# ---------------------------------------------------------------------------
mean_point = (
    alt.Chart(df)
    .mark_point(
        shape="diamond",
        size=220,
        color="#000000",
        filled=True,
        stroke="#000000",
    )
    .encode(
        x=alt.X("group:N", scale=alt.Scale(domain=GROUP_ORDER)),
        y=alt.Y(
            "mean(response):Q",
            title="Measured response",
            scale=alt.Y(zero=False),
        ),
        tooltip=[
            alt.Tooltip("group:N", title="Group"),
            alt.Tooltip("mean(response):Q", title="Mean", format=".3f"),
        ],
    )
)


# ---------------------------------------------------------------------------
# Layer 3: 95% bootstrapped confidence interval of the mean per group
# ---------------------------------------------------------------------------
# ``extent="ci"`` instructs the error-bar mark to compute a 95% confidence
# interval of the mean (the default level) for the encoded y field.
error_bars = (
    alt.Chart(df)
    .mark_errorbar(
        extent="ci",
        color="#000000",
        thickness=2,
        ticks={"size": 10, "thickness": 2, "color": "#000000"},
    )
    .encode(
        x=alt.X("group:N", scale=alt.Scale(domain=GROUP_ORDER)),
        y=alt.Y(
            "response:Q",
            title="Measured response",
            scale=alt.Y(zero=False),
        ),
    )
)


# ---------------------------------------------------------------------------
# Compose and save
# ---------------------------------------------------------------------------
chart = alt.layer(
    raw_points,
    error_bars,
    mean_point,
    data=df,
).properties(
    title=alt.TitleParams(
        text="Per-group mean with 95% confidence interval",
        subtitle="Jittered raw observations overlaid with group mean and bootstrapped 95% CI of the mean",
        fontSize=15,
        subtitleFontSize=12,
        anchor="start",
    ),
    width=520,
    height=380,
    padding={"left": 10, "right": 10, "top": 10, "bottom": 10},
).configure_axis(
    grid=True,
    gridColor="#e6e6e6",
    gridOpacity=0.6,
).configure_view(
    stroke="#cccccc",
)

# Make sure the output directory exists, then write a standalone HTML file
# with the data embedded directly inside the Vega-Lite specification.
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
chart.save(OUTPUT_PATH, format="html", inline=True)

print(f"Wrote self-contained chart to {OUTPUT_PATH}")
