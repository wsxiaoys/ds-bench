"""Build an interactive cross-filter sales dashboard as a self-contained HTML.

The dashboard is composed of two vertically concatenated Vega-Lite views
(stacked bar + line trend) that share a single legend-bound point selection on
the ``category`` field.  Clicking a legend entry highlights / focuses that
category across the entire dashboard.

The output is a single HTML file with Vega / Vega-Lite / vega-embed inlined
and the full dataset embedded inline, so the file renders offline with no
network access.
"""

from __future__ import annotations

from pathlib import Path

import altair as alt
import pandas as pd

# ---------------------------------------------------------------------------
# Paths & data load
# ---------------------------------------------------------------------------
PROJECT_DIR = Path("/home/user/project")
DATA_PATH = PROJECT_DIR / "data" / "sales.csv"
OUTPUT_PATH = PROJECT_DIR / "dashboard.html"


def load_sales(path: Path) -> pd.DataFrame:
    """Load the local sales CSV and parse the ``date`` column."""
    df = pd.read_csv(path, parse_dates=["date"])
    # Ensure stable column order / dtype for the JSON serializer.
    df = df[["date", "category", "sales"]]
    return df


# ---------------------------------------------------------------------------
# Dashboard spec
# ---------------------------------------------------------------------------
def build_dashboard(df: pd.DataFrame) -> alt.Chart:
    """Return a single Altair chart composed of two stacked linked views.

    Both views share the same selection parameter ``category_selection``,
    which is bound to the color legend (an interactive legend).  The bar view
    dims the non-selected categories via a conditional opacity encoding; the
    line view uses a filter transform to show only the selected category (or
    every category when nothing is selected).
    """
    # Shared interactive legend: clicking a legend entry selects that
    # category, toggling it on/off.  ``bind="legend"`` turns the legend into
    # the selection control.  ``on="mouseover"`` is intentionally omitted so
    # selection is driven by clicks (the standard pattern).
    category_selection = alt.selection_point(
        fields=["category"],
        bind="legend",
        name="category_selection",
    )

    # ---- Top view: stacked bar (monthly total, stacked by category) -------
    # Monthly aggregation per category, then stacked.  Conditional opacity
    # dims non-selected categories while the selected one stays fully opaque.
    bar_view = (
        alt.Chart(df)
        .mark_bar()
        .encode(
            x=alt.X("yearmonth(date):T", title="Month"),
            y=alt.Y("sum(sales):Q", title="Total sales (units)"),
            color=alt.Color(
                "category:N",
                title="Category",
                legend=alt.Legend(title="Product category (click)"),
            ),
            opacity=alt.condition(
                category_selection,
                alt.value(1.0),
                alt.value(0.18),
            ),
            tooltip=[
                alt.Tooltip("yearmonth(date):T", title="Month"),
                alt.Tooltip("category:N", title="Category"),
                alt.Tooltip("sum(sales):Q", title="Sales"),
            ],
        )
        .add_params(category_selection)
        .properties(
            title="Monthly total sales by category (click a legend entry)",
            width=720,
            height=260,
        )
    )

    # ---- Bottom view: line trend (monthly sales per category) -------------
    # The filter transform references the same selection so only the
    # selected category's line is shown; when no category is selected, the
    # filter keeps every category (empty / null selection -> no filter).
    line_view = (
        alt.Chart(df)
        .mark_line(point=True, strokeWidth=2.5)
        .transform_filter(category_selection)
        .encode(
            x=alt.X("yearmonth(date):T", title="Month"),
            y=alt.Y("sales:Q", title="Monthly sales (units)"),
            color=alt.Color("category:N", title="Category"),
            tooltip=[
                alt.Tooltip("yearmonth(date):T", title="Month"),
                alt.Tooltip("category:N", title="Category"),
                alt.Tooltip("sales:Q", title="Sales"),
            ],
        )
        .properties(
            title="Monthly sales trend per category",
            width=720,
            height=260,
        )
    )

    # Concatenate vertically into a single chart.  Sharing the
    # ``category_selection`` parameter between both sub-charts is what makes
    # a single legend control the entire dashboard.
    return alt.vconcat(
        bar_view,
        line_view,
        title="Sales dashboard",
        spacing=24,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    df = load_sales(DATA_PATH)
    chart = build_dashboard(df)

    # ``inline=True`` uses the INLINE_HTML_TEMPLATE + vl_convert's
    # ``javascript_bundle`` so that vega, vega-lite, and vega-embed are
    # embedded in the document, and the full dataframe is also embedded
    # inline (no CSV / http(s) data reference is emitted).
    chart.save(
        str(OUTPUT_PATH),
        format="html",
        inline=True,
    )
    print(f"Wrote {OUTPUT_PATH} ({OUTPUT_PATH.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
