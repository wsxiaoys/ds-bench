"""Build the barley grouped-bar chart HTML using Altair.

This script loads the classic ``barley`` dataset via its Vega Datasets
URL, builds a faceted, grouped bar chart of mean barley yield per
``(site, variety)``, and overlays a per-site mean tick across varieties.

The final chart is exported as a self-contained interactive HTML page at
``/home/user/altair_task/output/chart.html``.
"""

import os

import altair as alt
from altair.datasets import data


def build_chart() -> alt.TopLevelMixin:
    """Construct the Altair chart described in the task spec."""

    # Reference the dataset by URL so the exported Vega-Lite spec
    # retains an explicit ``barley`` dataset reference.
    barley_url = data.barley.url

    # Sort sites by the overall (across years and varieties) mean yield,
    # descending. ``EncodingSortField`` runs the aggregation inside the
    # spec — this is the form to use when passing the sort definition
    # directly to an encoding's ``.sort(...)``.
    site_sort = alt.EncodingSortField(
        op="mean",
        field="yield",
        order="descending",
    )

    # ------------------------------------------------------------------
    # Layer 1: grouped bars -- mean(yield) per (site, variety)
    # ------------------------------------------------------------------
    bars = alt.Chart(barley_url, name="bars").mark_bar().encode(
        x=alt.X("site:N")
            .sort(site_sort)
            .title("Site"),
        xOffset=alt.XOffset("variety:N").title("Variety"),
        y=alt.Y("mean(yield):Q").title("Mean Yield"),
        color=alt.Color("variety:N")
            .scale(scheme="tableau10")
            .title("Variety"),
        tooltip=[
            alt.Tooltip("site:N", title="Site"),
            alt.Tooltip("variety:N", title="Variety"),
            alt.Tooltip("mean(yield):Q", title="Mean Yield", format=".2f"),
        ],
    )

    # ------------------------------------------------------------------
    # Layer 2: per-site mean across varieties, computed inside the spec
    # via ``transform_aggregate`` (not pre-computed in pandas).
    # Group-by both ``site`` and ``year`` so the mean is "for that year"
    # after the layer is faceted on ``year``.
    # ------------------------------------------------------------------
    site_means = (
        alt.Chart(barley_url, name="site_means")
        .mark_tick(color="black", thickness=2, size=40)
        .encode(
            x=alt.X("site:N").sort(site_sort).title("Site"),
            y=alt.Y("mean_yield:Q").title("Mean Yield (per-site)"),
            tooltip=[
                alt.Tooltip("site:N", title="Site"),
                alt.Tooltip("mean_yield:Q", title="Per-site mean yield"),
            ],
        )
        .transform_aggregate(
            mean_yield="mean(yield)",
            groupby=["site", "year"],
        )
    )

    # ------------------------------------------------------------------
    # Combine the two layers and facet by year (one panel per year).
    # ------------------------------------------------------------------
    layered = alt.layer(bars, site_means)

    chart = (
        layered.facet(column=alt.Column("year:O").title("Year"))
        .properties(
            title=alt.Title(
                text="Barley Yield by Site and Variety",
                subtitle=(
                    "Grouped bars: mean yield per (site, variety); "
                    "black tick: per-site mean across varieties."
                ),
            ),
            description=(
                "Faceted grouped bar chart of mean barley yield per "
                "(site, variety), with a per-site mean tick overlay, "
                "using Altair's ``barley`` dataset."
            ),
        )
        .resolve_scale(y="independent")
    )

    return chart


def main() -> None:
    output_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "output"
    )
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "chart.html")

    chart = build_chart()
    chart.save(output_path)

    print(f"Wrote chart to {output_path}")


if __name__ == "__main__":
    main()
