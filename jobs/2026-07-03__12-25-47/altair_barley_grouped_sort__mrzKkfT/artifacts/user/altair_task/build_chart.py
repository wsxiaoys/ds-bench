"""Build the barley grouped-bar chart HTML."""

import os
import altair as alt
from altair.datasets import data


def main() -> None:
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)

    barley_url = data.barley.url

    sort_by_mean_yield_desc = dict(
        field="mean(yield)",
        op="mean",
        order="descending",
    )

    # Main grouped bars: mean(yield) per (site, variety), grouped by site via xOffset
    base_bars = (
        alt.Chart(barley_url)
        .mark_bar()
        .encode(
            x=alt.X(
                "site:N",
                sort=sort_by_mean_yield_desc,
                title="Site",
            ),
            y=alt.Y(
                "mean(yield):Q",
                title="Mean Yield",
            ),
            color=alt.Color(
                "variety:N",
                scale=alt.Scale(scheme="tableau10"),
                title="Variety",
            ),
            xOffset=alt.XOffset("variety:N", title="Variety"),
            tooltip=["site:N", "variety:N", "mean(yield):Q"],
        )
        .properties(width=240, height=200)
    )

    # Per-site mean yield across all varieties for each year (computed in-spec)
    site_mean = (
        alt.Chart(barley_url)
        .transform_aggregate(
            mean_yield="mean(yield)",
            groupby=["site", "year"],
        )
        .mark_tick(color="black", thickness=3, size=40)
        .encode(
            x=alt.X(
                "site:N",
                sort=sort_by_mean_yield_desc,
                title="Site",
            ),
            y=alt.Y("mean_yield:Q", title="Mean Yield"),
        )
    )

    layered = alt.layer(base_bars, site_mean).facet(
        facet=alt.Facet("year:O", title="Year"),
        columns=2,
    )

    chart = layered.properties(
        title=alt.Title(
            text="Barley Yield by Variety and Site",
            subtitle="Grouped bars: mean yield per (site, variety); black ticks: per-site mean across varieties.",
        )
    )

    out_path = os.path.join(output_dir, "chart.html")
    chart.save(out_path)
    print(f"Saved chart to {out_path}")


if __name__ == "__main__":
    main()
