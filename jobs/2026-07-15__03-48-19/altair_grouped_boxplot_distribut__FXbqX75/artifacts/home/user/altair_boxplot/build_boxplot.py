"""Build a grouped, faceted box-plot of tensile strength and save it as HTML."""

from pathlib import Path

import altair as alt
import pandas as pd

# Altair 6 embeds data passed as a DataFrame directly into the spec, so the
# resulting HTML contains no remote data URL and works fully offline.
alt.data_transformers.enable("default")

PROJECT = Path("/home/user/altair_boxplot")
CSV_PATH = PROJECT / "data" / "measurements.csv"
OUT_PATH = PROJECT / "output" / "grouped_boxplot.html"
OUT_PATH.parent.mkdir(parents=True, exist_ok=True)

# --- Load the local CSV dataset ---------------------------------------------
df = pd.read_csv(CSV_PATH)

# --- Build the chart ---------------------------------------------------------
# Box-plot mark: whisker extent = 2 * IQR, fixed box size, whisker end-caps on.
boxplot = alt.Chart(df).mark_boxplot(
    extent=2,
    size=40,
    ticks=True,
    orient="vertical",
)

chart = boxplot.encode(
    # Alloy category on the x axis (nominal).
    x=alt.X("alloy:N", axis=alt.Axis(title="Alloy Grade")),
    # Measured strength on the y axis (quantitative), do not force zero.
    y=alt.Y("strength_mpa:Q", scale=alt.Scale(zero=False),
            axis=alt.Axis(title="Tensile Strength (MPa)")),
    # Colour each box by the heat-treatment condition.
    color=alt.Color("treatment:N", legend=alt.Legend(title="Treatment")),
    # Dodge the differently-coloured boxes side-by-side within each alloy.
    xOffset=alt.X("treatment:N"),
    # Facet the whole plot into one column per supplier.
    column=alt.Column("supplier:N", header=alt.Header(title="Supplier")),
)

# --- Save as a self-contained HTML file -------------------------------------
chart.save(str(OUT_PATH))

print(f"Saved chart to {OUT_PATH}")
print(f"Rows loaded: {len(df)}")
print(f"Alloys: {sorted(df['alloy'].unique())}")
print(f"Treatments: {sorted(df['treatment'].unique())}")
print(f"Suppliers: {sorted(df['supplier'].unique())}")