"""Build a faceted, grouped bar chart of the barley dataset.

The chart compares barley *variety* mean yields across *site*, faceted by
*year*, and overlays a per-site mean tick computed inside the Vega-Lite spec.
"""

from pathlib import Path

import altair as alt
from altair.datasets import data

# Use the remote URL so the exported Vega-Lite spec retains an explicit
# `barley` dataset reference (rather than inlining the data).
source = data.barley.url

OUTPUT_DIR = Path("/home/user/altair_task/output")
OUTPUT_FILE = OUTPUT_DIR / "chart.html"


# --- Main mark: grouped bars of mean(yield) per (site, variety) -------------
# Sites are ordered on the x-axis by their overall mean yield, descending,
# using the method-based sort syntax with an aggregated field.
x_encoding = alt.X("site:N", title="Site").sort(
    field="yield", op="mean", order="descending"
)

bars = (
    alt.Chart(source)
    .mark_bar()
    .encode(
        x=x_encoding,
        # xOffset groups the varieties within each site.
        xOffset="variety:N",
        y=alt.Y("mean(yield):Q", title="Mean Yield"),
        color=alt.Color(
            "variety:N",
            title="Variety",
            scale=alt.Scale(scheme="tableau10"),
            legend=alt.Legend(title="Variety"),
        ),
        tooltip=[
            alt.Tooltip("site:N", title="Site"),
            alt.Tooltip("variety:N", title="Variety"),
            alt.Tooltip("mean(yield):Q", title="Mean Yield", format=".2f"),
        ],
    )
)

# --- Overlay: per-site mean yield across all varieties (per facet) ----------
# The mean is derived inside the spec via an aggregate transform, grouped by
# site and year (year is the facet field, so each facet keeps a single year).
site_mean_ticks = (
    alt.Chart(source)
    .mark_tick(
        color="black",
        thickness=2.5,
        orient="horizontal",
        size=18,  # length of the horizontal tick across the bar group
    )
    .transform_aggregate(
        site_mean="mean(yield)",
        groupby=["site", "year"],
    )
    .encode(
        # Match the bar layer's x ordering so ticks line up with the groups.
        x=alt.X("site:N").sort(field="yield", op="mean", order="descending"),
        y=alt.Y("site_mean:Q", title="Mean Yield"),
        tooltip=[
            alt.Tooltip("site:N", title="Site"),
            alt.Tooltip("year:O", title="Year"),
            alt.Tooltip("site_mean:Q", title="Site Mean Yield", format=".2f"),
        ],
    )
)

# --- Combine layers and facet by year ---------------------------------------
chart = (
    alt.layer(bars, site_mean_ticks)
    .properties(
        width=640,
        height=220,
    )
    .facet(row=alt.Row("year:O", title="Year"))
    .properties(
        title=alt.Title(
            text="Barley Yield by Site and Variety",
            subtitle=(
                "Grouped mean yield per (site, variety), faceted by year, "
                "with the per-site average overlaid as a tick"
            ),
            anchor="start",
        ),
    )
)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    chart.save(str(OUTPUT_FILE))
    print(f"Wrote chart to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()