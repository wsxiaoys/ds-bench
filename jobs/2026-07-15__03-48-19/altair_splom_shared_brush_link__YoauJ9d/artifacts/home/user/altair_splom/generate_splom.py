"""
Generate a self-contained interactive SPLOM (Scatterplot Matrix) chart
using Vega-Altair with a single shared interval brush.

Output: /home/user/altair_splom/chart.html  (fully offline, no CDN fetches)
"""

import pandas as pd
import altair as alt

# -- 1. Load the local CSV dataset with pandas (fully offline) -----------------
DATA_PATH = "/home/user/altair_splom/data/measurements.csv"
df = pd.read_csv(DATA_PATH)

# -- 2. Define the four quantitative features ----------------------------------
features = ["temperature", "pressure", "humidity", "vibration"]

# -- 3. Create a single shared interval selection (brush) ----------------------
# Defined once so it is shared globally across ALL panels of the SPLOM.
brush = alt.selection_interval()

# -- 4. Build the repeated scatter chart --------------------------------------
# x binds to the repeated *column* field, y binds to the repeated *row* field.
# Color is a conditional encoding driven by the brush:
#   - inside the brush  -> colored by machine_class (nominal)
#   - outside the brush -> light gray
chart = (
    alt.Chart(df)
    .mark_circle(opacity=0.7)
    .encode(
        x=alt.X(alt.repeat("column"), type="quantitative"),
        y=alt.Y(alt.repeat("row"), type="quantitative"),
        color=alt.condition(
            brush,
            alt.Color("machine_class:N"),
            alt.value("lightgray"),
        ),
        tooltip=[
            "temperature",
            "pressure",
            "humidity",
            "vibration",
            "machine_class",
        ],
    )
    .properties(width=150, height=150)
    .add_params(brush)
    .repeat(
        row=features,   # each feature appears as a row
        column=features,  # each feature appears as a column
    )
    .properties(
        title="Interactive SPLOM — Factory Sensor Measurements (drag to brush)",
    )
)

# -- 5. Save as a fully self-contained HTML file -------------------------------
# Use vl-convert-python with bundle=True so that vega, vega-lite, and
# vega-embed JavaScript are embedded directly in the HTML (no CDN fetches).
import vl_convert as vlc

OUTPUT_PATH = "/home/user/altair_splom/chart.html"

vl_spec = chart.to_dict()
html_string = vlc.vegalite_to_html(vl_spec, bundle=True)

with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    f.write(html_string)

print(f"Self-contained SPLOM chart saved to {OUTPUT_PATH}")