"""
Generate an interactive scatterplot matrix (SPLOM) with a shared brush.

The output is a fully self-contained HTML file that:
  - Embeds all Vega/Vega-Lite/Vega-Embed JavaScript inline (no CDN).
  - Embeds the dataset inline from a pandas DataFrame.
  - Highlights brushed specimens across ALL panels simultaneously via a
    single global interval selection.
  - Colors brushed specimens by machine_class (nominal) and grays out
    the rest.
"""

import pathlib
import pandas as pd
import altair as alt

# ── Paths ────────────────────────────────────────────────────────────────────
BASE = pathlib.Path("/home/user/altair_splom")
CSV_PATH = BASE / "data" / "measurements.csv"
OUT_PATH = BASE / "chart.html"

# ── Data ─────────────────────────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH)

features = ["temperature", "pressure", "humidity", "vibration"]

# ── Selection ─────────────────────────────────────────────────────────────────
# A single interval (brush) selection shared globally across all panels.
# resolve="global" (the default) means one brush exists for the whole SPLOM:
# dragging in any panel clears the previous brush and creates a new one,
# and the highlight propagates to every panel.
brush = alt.selection_interval(name="brush", resolve="global", empty=True)

# ── Base chart ────────────────────────────────────────────────────────────────
# alt.repeat("column") / alt.repeat("row") are the placeholder references
# for the repeated x / y fields.
base = (
    alt.Chart(df)
    .mark_point(filled=True, size=40, opacity=0.7)
    .encode(
        x=alt.X(alt.repeat("column"), type="quantitative"),
        y=alt.Y(alt.repeat("row"), type="quantitative"),
        # Conditional color: machine_class when inside brush, gray otherwise.
        color=alt.condition(
            brush,
            alt.Color("machine_class:N", legend=alt.Legend(title="Machine Class")),
            alt.value("lightgray"),
        ),
        # Make brushed points pop slightly with opacity conditioning too.
        opacity=alt.condition(brush, alt.value(0.85), alt.value(0.25)),
        tooltip=[
            alt.Tooltip("machine_class:N", title="Class"),
            alt.Tooltip("temperature:Q", format=".2f"),
            alt.Tooltip("pressure:Q", format=".2f"),
            alt.Tooltip("humidity:Q", format=".2f"),
            alt.Tooltip("vibration:Q", format=".3f"),
        ],
    )
    # Add the brush to the base spec so it is shared across all repeated panels.
    .add_params(brush)
    .properties(width=160, height=160)
)

# ── SPLOM via repeat ──────────────────────────────────────────────────────────
splom = base.repeat(
    row=features,
    column=features,
)

splom = splom.properties(
    title=alt.Title(
        text="Factory Sensor Scatterplot Matrix",
        subtitle="Drag to brush any panel — highlighted specimens appear across all panels",
        anchor="middle",
    )
)

# ── Save as fully self-contained HTML (inline JS, inline data) ────────────────
# inline=True embeds Vega, Vega-Lite and Vega-Embed JS directly in the HTML
# so the file renders with no network access.
splom.save(str(OUT_PATH), format="html", inline=True)

print(f"Chart saved to: {OUT_PATH}  ({OUT_PATH.stat().st_size:,} bytes)")
