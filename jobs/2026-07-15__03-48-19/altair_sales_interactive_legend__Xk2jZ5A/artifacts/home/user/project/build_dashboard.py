#!/usr/bin/env python3
"""Build an offline, self-contained interactive-legend cross-filter sales dashboard.

Produces /home/user/project/dashboard.html using Altair 5+ syntax. The dashboard
contains two vertically stacked linked views that share a single interactive
(point) legend bound to the `category` field:

  * Stacked bar view  - total monthly sales stacked/colored by category, with a
                        conditional opacity encoding (selected = opaque, others
                        dimmed).
  * Time-series view  - one line per category, narrowed by a filter transform
                        driven by the same selection (all lines shown when
                        nothing is selected).

The HTML is saved with inline=True so the Vega/Vega-Lite/vega-embed runtime and
the full dataset are embedded inline -> renders with no network access.
"""

from pathlib import Path

import altair as alt
import pandas as pd

BASE = Path(__file__).resolve().parent
DATA_PATH = BASE / "data" / "sales.csv"
OUT_PATH = BASE / "dashboard.html"


def main() -> None:
    # --- Load local data -------------------------------------------------
    df = pd.read_csv(DATA_PATH, parse_dates=["date"])
    # Ensure tidy typing for Vega-Lite.
    df["category"] = df["category"].astype(str)
    df["sales"] = df["sales"].astype(int)

    # --- Shared interactive legend selection -----------------------------
    # A single point selection projected on `category` and bound to the legend.
    # Reused by both views so one legend controls the entire dashboard.
    sel = alt.selection_point(
        fields=["category"],
        bind="legend",
        name="category_sel",
    )

    # --- Stacked bar view ------------------------------------------------
    bar = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X("yearmonth(date):T", title="Month"),
            y=alt.Y("sum(sales):Q", title="Total Sales"),
            color=alt.Color("category:N", title="Category"),
            # Conditional opacity: selected category is fully opaque (1),
            # non-selected categories are dimmed (0.2). When nothing is
            # selected the empty-selection default (empty="all") makes the
            # condition true for every mark, so all bars are fully opaque.
            opacity=alt.condition(sel, alt.value(1), alt.value(0.2)),
        )
        .add_params(sel)
        .properties(
            width=720,
            height=300,
            title="Monthly Sales by Category (stacked)",
        )
    )

    # --- Time-series line view -------------------------------------------
    line = (
        alt.Chart(df)
        .mark_line(point=True, strokeWidth=2.5)
        .encode(
            x=alt.X("yearmonth(date):T", title="Month"),
            y=alt.Y("sum(sales):Q", title="Sales"),
            # Share the same color scale; suppress the legend here so only
            # the bar view's legend is shown (single legend for the dashboard).
            color=alt.Color("category:N", title="Category", legend=None),
            # detail keeps one line per category even when color legend hidden.
            detail=alt.Detail("category:N"),
        )
        # Filter transform driven by the same selection: only the selected
        # category's line is shown. With an empty selection (empty="all") the
        # filter passes every row, so all lines are shown.
        .transform_filter(sel)
        .properties(
            width=720,
            height=300,
            title="Monthly Sales Trend (click legend to focus)",
        )
    )

    # --- Compose into one chart ------------------------------------------
    dashboard = (
        (bar & line)
        .resolve_scale(color="shared", x="shared")
        .configure_legend(
            labelFontSize=12,
            titleFontSize=13,
            symbolSize=150,
        )
        .configure_view(stroke=None)
    )

    # --- Save self-contained offline HTML --------------------------------
    # inline=True embeds the vega/vega-lite/vega-embed JS and the full data
    # inline (requires vl-convert-python, which is installed).
    dashboard.save(
        str(OUT_PATH),
        format="html",
        inline=True,
        embed_options={"actions": True},
    )
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()