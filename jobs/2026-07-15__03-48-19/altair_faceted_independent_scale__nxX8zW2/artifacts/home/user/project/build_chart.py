"""Build a faceted small-multiple line chart with independent y-axes.

Reads the long-form metrics data from metrics.csv, builds a 2-column wrapped
grid of one line-chart panel per series where every panel scales its own
y-axis independently while sharing a single color legend and a single shared
hover tooltip, and saves the result as a standalone HTML document.
"""

import altair as alt
import pandas as pd

DATA_PATH = "/home/user/project/metrics.csv"
OUTPUT_PATH = "/home/user/project/chart.html"


def main() -> None:
    # Load the long-form data so Altair can infer column types.
    df = pd.read_csv(DATA_PATH)

    # Single shared point selection with nearest-point detection, triggered on
    # pointer-over. Because it is added to the inner (pre-facet) chart, the same
    # parameter drives every facet panel.
    hover = alt.selection_point(
        nearest=True,
        on="pointerover",
        fields=["date"],
        empty=False,
    )

    # Common encodings for both the line and the hover marker. Color is encoded
    # here (nominal by series) so the color scale stays shared across panels and
    # produces a single legend. The tooltip lists date and value.
    base = alt.Chart(df).encode(
        x=alt.X("date:T", title="Date"),
        y=alt.Y("value:Q", title="Value"),
        color=alt.Color("series:N", legend=alt.Legend(title="Series")),
        tooltip=[alt.Tooltip("date:T", title="Date"),
                 alt.Tooltip("value:Q", title="Value")],
    )

    # The line itself.
    lines = base.mark_line()

    # Invisible-by-default markers that become visible at the nearest point
    # under the pointer; they carry the tooltip and the shared selection.
    points = (
        base.mark_circle()
        .encode(
            opacity=alt.condition(hover, alt.value(1.0), alt.value(0.0)),
        )
        .add_params(hover)
    )

    # Combine into the inner chart, then facet into a wrapped 2-column grid
    # (one panel per series) and resolve the y scale independently per panel
    # while leaving the color scale shared (the default resolution).
    chart = (
        (lines + points)
        .properties(width=320, height=220)
        .facet(column=alt.Column("series:N", title="Series"), columns=2)
        .resolve_scale(y="independent")
        .properties(title="Operational Metrics Over Time")
    )

    # Save as a fully self-contained HTML document that embeds the entire
    # Vega-Lite spec inline (no external data source needed at view time).
    chart.save(OUTPUT_PATH)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()