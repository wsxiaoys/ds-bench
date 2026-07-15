"""
grouped_boxplot.py
==================
Produces a grouped, faceted box-plot of aluminium-alloy tensile strength
measurements using Vega-Altair 6 and saves the result as a self-contained
HTML file.

Layout
------
- Column facet  : supplier  (North | South)
- X axis        : alloy grade (nominal)
- Y axis        : tensile strength in MPa (quantitative, zero excluded)
- Colour        : heat-treatment condition (nominal)
- X-offset dodge: heat-treatment condition (nominal) – side-by-side within alloy

Box-plot configuration
----------------------
- extent = 2   (whisker reaches to ±2 × IQR from Q1/Q3)
- size   = 40  (box width in pixels)
- ticks  = True (whisker end-cap ticks enabled)
"""

from pathlib import Path
import pandas as pd
import altair as alt

# ── paths ──────────────────────────────────────────────────────────────────
BASE_DIR  = Path("/home/user/altair_boxplot")
INPUT_CSV = BASE_DIR / "data" / "measurements.csv"
OUTPUT_HTML = BASE_DIR / "output" / "grouped_boxplot.html"
OUTPUT_HTML.parent.mkdir(parents=True, exist_ok=True)

# ── data ───────────────────────────────────────────────────────────────────
df = pd.read_csv(INPUT_CSV)

# ── chart ──────────────────────────────────────────────────────────────────
chart = (
    alt.Chart(df)
    .mark_boxplot(
        extent=2,       # whisker reaches ±2 × IQR from box edges
        size=40,        # box width (pixels)
        ticks=True,     # draw end-cap ticks on each whisker
    )
    .encode(
        x=alt.X("alloy:N").axis(title="Alloy Grade"),
        y=alt.Y("strength_mpa:Q")
            .scale(zero=False)
            .axis(title="Tensile Strength (MPa)"),
        color=alt.Color("treatment:N").legend(title="Heat Treatment"),
        xOffset=alt.XOffset("treatment:N"),
        column=alt.Column("supplier:N").header(title="Supplier"),
    )
    .properties(
        width=260,
        height=350,
        title="Tensile Strength Distribution by Alloy, Treatment & Supplier",
    )
    .configure_view(stroke="lightgrey")
    .configure_axis(labelFontSize=12, titleFontSize=13)
    .configure_header(titleFontSize=14, labelFontSize=13)
    .configure_legend(titleFontSize=13, labelFontSize=12)
)

# ── save ───────────────────────────────────────────────────────────────────
chart.save(str(OUTPUT_HTML))
print(f"Chart saved → {OUTPUT_HTML}")
