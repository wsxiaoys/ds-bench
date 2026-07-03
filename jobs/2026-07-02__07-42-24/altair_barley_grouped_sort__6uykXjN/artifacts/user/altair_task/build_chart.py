"""Build the barley grouped-bar chart HTML.

This script constructs a faceted, grouped bar chart using the vega-datasets barley
dataset, with sites ordered by aggregated yield descending, and overlays the per-site
mean yield calculated inside the spec.
"""

import os
import altair as alt
from vega_datasets import data


def main() -> None:
    # Ensure output directory exists
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "chart.html")

    # Use the named barley dataset URL directly as requested
    barley_data = data.barley.url

    # 1. Build the main grouped bar chart
    bar_chart = alt.Chart(barley_data).mark_bar().encode(
        x=alt.X("site:N").sort(field="yield", op="mean", order="descending"),
        y=alt.Y("mean(yield):Q", title="Mean Yield (bushels/acre)"),
        xOffset=alt.XOffset("variety:N"),
        color=alt.Color("variety:N")
        .scale(scheme="tableau10")
        .legend(title="Variety"),
        tooltip=[
            alt.Tooltip("site:N", title="Site"),
            alt.Tooltip("variety:N", title="Variety"),
            alt.Tooltip("year:O", title="Year"),
            alt.Tooltip("mean(yield):Q", title="Variety Mean Yield", format=".2f"),
        ],
    )

    # 2. Build the per-site mean overlay (tick mark)
    tick_chart = (
        alt.Chart(barley_data)
        .mark_tick(
            color="black",
            size=25,
            thickness=3,
        )
        .transform_aggregate(
            mean_yield="mean(yield)",
            groupby=["site", "year"],
        )
        .encode(
            x=alt.X("site:N").sort(field="mean_yield", op="mean", order="descending"),
            y=alt.Y("mean_yield:Q"),
            tooltip=[
                alt.Tooltip("site:N", title="Site"),
                alt.Tooltip("year:O", title="Year"),
                alt.Tooltip("mean_yield:Q", title="Per-Site Mean Yield", format=".2f"),
            ],
        )
    )

    # 3. Combine layered charts and facet by year
    chart = (
        alt.layer(bar_chart, tick_chart)
        .facet(
            facet=alt.Facet("year:O", title="Year"),
        )
        .properties(
            title=alt.TitleParams(
                text="Barley Yields by Variety and Site",
                subtitle="Faceted by year, with sites ordered by overall mean yield (descending) and per-site mean yield overlays",
            )
        )
    )

    # Save the chart as a self-contained HTML file
    chart.save(output_path)
    print(f"Chart successfully built and saved to {output_path}")


if __name__ == "__main__":
    main()
