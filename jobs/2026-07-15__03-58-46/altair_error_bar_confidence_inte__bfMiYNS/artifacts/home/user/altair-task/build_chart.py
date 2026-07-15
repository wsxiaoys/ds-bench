"""
build_chart.py
--------------
Produces a publication-quality layered Altair chart showing:
  1. Raw (jittered) observations per group
  2. Group mean as a prominent point marker
  3. 95% bootstrapped confidence interval of the mean as an error bar

Output: output/chart.html  (self-contained, data embedded)
"""

import pathlib
import altair as alt
import pandas as pd

# ── paths ──────────────────────────────────────────────────────────────────────
BASE_DIR  = pathlib.Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "measurements.csv"
OUT_DIR   = BASE_DIR / "output"
OUT_PATH  = OUT_DIR / "chart.html"

OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── data ───────────────────────────────────────────────────────────────────────
df = pd.read_csv(DATA_PATH)
# Ensure group column is treated as an ordered categorical so A→D stay sorted
df["group"] = pd.Categorical(df["group"], categories=sorted(df["group"].unique()), ordered=True)

# ── shared encoding scaffolding ────────────────────────────────────────────────
GROUP_SORT = ["A", "B", "C", "D"]

x_base = alt.X(
    "group:O",
    sort=GROUP_SORT,
    axis=alt.Axis(labelFontSize=13, titleFontSize=14, labelAngle=0),
    title="Treatment Group",
)

y_base = alt.Y(
    "response:Q",
    axis=alt.Axis(labelFontSize=12, titleFontSize=14),
    title="Response",
    scale=alt.Scale(zero=False),
)

color_enc = alt.Color(
    "group:O",
    sort=GROUP_SORT,
    legend=None,
    scale=alt.Scale(scheme="tableau10"),
)

# ── Layer 1 – jittered raw observations ───────────────────────────────────────
# A transform_calculate creates a small random x-offset; the offset channel
# shifts points left/right within the ordinal band without altering the axis.
jitter_layer = (
    alt.Chart(df)
    .transform_calculate(jitter="(random() - 0.5) * 0.4")   # ±0.2 band-width units
    .mark_circle(opacity=0.45, size=40)
    .encode(
        x=alt.X("group:O", sort=GROUP_SORT, title="Treatment Group",
                 axis=alt.Axis(labelFontSize=13, titleFontSize=14, labelAngle=0)),
        xOffset=alt.XOffset("jitter:Q"),                     # horizontal jitter
        y=alt.Y("response:Q", title="Response",
                 scale=alt.Scale(zero=False),
                 axis=alt.Axis(labelFontSize=12, titleFontSize=14)),
        color=color_enc,
        tooltip=[
            alt.Tooltip("group:O", title="Group"),
            alt.Tooltip("response:Q", title="Response", format=".3f"),
        ],
    )
)

# ── Layer 2 – group mean (prominent filled point) ─────────────────────────────
mean_layer = (
    alt.Chart(df)
    .mark_point(
        filled=True,
        size=160,
        shape="diamond",
        stroke="white",
        strokeWidth=1.2,
        opacity=1.0,
    )
    .encode(
        x=alt.X("group:O", sort=GROUP_SORT),
        y=alt.Y("mean(response):Q"),
        color=color_enc,
        tooltip=[
            alt.Tooltip("group:O",           title="Group"),
            alt.Tooltip("mean(response):Q",  title="Mean",  format=".3f"),
        ],
    )
)

# ── Layer 3 – 95 % bootstrapped CI error bars ─────────────────────────────────
ci_layer = (
    alt.Chart(df)
    .mark_errorbar(extent="ci", ticks=True, size=8, thickness=2.2)
    .encode(
        x=alt.X("group:O", sort=GROUP_SORT),
        y=alt.Y("response:Q", title="Response"),
        color=color_enc,
    )
)

# ── Compose & style ────────────────────────────────────────────────────────────
chart = (
    alt.layer(jitter_layer, ci_layer, mean_layer)
    .properties(
        title=alt.TitleParams(
            text="Treatment Group Responses with 95 % Confidence Intervals",
            subtitle="Diamonds = group mean  ·  Error bars = 95 % bootstrapped CI  ·  Circles = individual observations",
            fontSize=16,
            subtitleFontSize=12,
            anchor="middle",
        ),
        width=520,
        height=380,
    )
    .configure_view(strokeWidth=0)
    .configure_axis(grid=True, gridOpacity=0.25)
)

# ── Save as self-contained HTML (data embedded, no CDN data reference) ─────────
chart.save(str(OUT_PATH), embed_options={"renderer": "svg"})
print(f"Chart saved → {OUT_PATH}")
