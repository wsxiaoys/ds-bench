"""
Generate a self-contained interactive Scatterplot Matrix (SPLOM) with a
shared brush using Vega-Altair.

Reads a local CSV of sensor measurements and writes a fully self-contained
HTML file (no remote CDN) to chart.html.
"""

import pandas as pd
import altair as alt


DATA_PATH = "/home/user/altair_splom/data/measurements.csv"
OUTPUT_PATH = "/home/user/altair_splom/chart.html"

# Four quantitative sensor features used for the SPLOM.
FEATURES = ["temperature", "pressure", "humidity", "vibration"]


def main() -> None:
    df = pd.read_csv(DATA_PATH)

    # Ensure the categorical column is typed properly so the conditional
    # color encoding treats it as nominal.
    df["machine_class"] = df["machine_class"].astype(str)

    # ONE shared interval selection defined on the repeated spec so that
    # brushing in any panel highlights the same specimens in every panel.
    brush = alt.selection_interval(name="brush", resolve="global")

    # Conditional color: inside the brush use machine_class (nominal),
    # outside the brush render in neutral light-gray.
    color_condition = alt.condition(
        brush,
        alt.Color("machine_class:N", title="Machine class"),
        alt.value("lightgray"),
    )

    chart = (
        alt.Chart(df)
        .mark_point(filled=True, size=40, opacity=0.75)
        .encode(
            x=alt.X(alt.repeat("column"), type="quantitative"),
            y=alt.Y(alt.repeat("row"), type="quantitative"),
            color=color_condition,
            tooltip=[
                "temperature:Q",
                "pressure:Q",
                "humidity:Q",
                "vibration:Q",
                "machine_class:N",
            ],
        )
        .properties(width=140, height=140)
        .repeat(
            row=FEATURES,
            column=FEATURES,
        )
        .add_params(brush)
        .interactive()
    )

    chart.save(OUTPUT_PATH, inline=True)
    print(f"Saved self-contained SPLOM to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
