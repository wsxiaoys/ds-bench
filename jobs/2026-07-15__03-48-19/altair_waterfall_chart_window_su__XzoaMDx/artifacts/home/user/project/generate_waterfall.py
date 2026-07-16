#!/usr/bin/env python3
"""Generate a waterfall chart of sequential cash-flow deltas with Vega-Altair.

The chart is exported as a self-contained HTML file that renders in any browser.
All data is loaded locally from data/cash_flow.csv -- no remote URLs are used.
"""

import os

import pandas as pd
import altair as alt


PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(PROJECT_DIR, "data", "cash_flow.csv")
OUTPUT_PATH = os.path.join(PROJECT_DIR, "waterfall.html")


def main() -> None:
    # Load the data locally (in-memory); preserve the file's row order.
    df = pd.read_csv(CSV_PATH)
    # An explicit ordering column guarantees the window transform and the
    # x-axis both respect the original file order (no alphabetical re-sort).
    df["order"] = range(len(df))

    # Base chart with transforms shared by bars and text labels.
    base = alt.Chart(df).transform_window(
        # Running cumulative total of `amount` across the ordered rows.
        cumulative="sum(amount)",
        sort=[alt.SortField("order", order="ascending")],
        frame=[None, 0],  # from the first row up to the current row
    ).transform_calculate(
        # Bar start: previous cumulative total (cumulative - amount).
        # The `End` row (amount 0) is special: it spans from 0 to the grand
        # total, so its start is forced to 0.
        y='datum.label == "End" ? 0 : (datum.cumulative - datum.amount)',
        # Bar end: the new cumulative total.
        y2="datum.cumulative",
        # Color category: increase / decrease / baseline (Begin & End).
        bar_type=(
            'datum.label == "Begin" || datum.label == "End" '
            '? "baseline" '
            ': (datum.amount > 0 ? "increase" : "decrease")'
        ),
        # Label text: the delta amount, except for `End` which shows the
        # grand total (the cumulative sum at that point).
        text_val='datum.label == "End" ? datum.cumulative : datum.amount',
    )

    x_encoding = alt.X(
        "label:N",
        sort=alt.EncodingSortField(field="order", order="ascending"),
        axis=alt.Axis(title="Step", labelAngle=-30),
    )

    # Floating bars: each bar goes from y (start) to y2 (end).
    bars = base.mark_bar().encode(
        x=x_encoding,
        y=alt.Y("y:Q", title="Cumulative Balance"),
        y2=alt.Y2("y2:Q"),
        color=alt.Color(
            "bar_type:N",
            scale=alt.Scale(
                domain=["increase", "decrease", "baseline"],
                range=["#2E7D32", "#C62828", "#1565C0"],  # green / red / blue
            ),
            legend=alt.Legend(title="Type"),
        ),
        tooltip=[
            alt.Tooltip("label:N", title="Step"),
            alt.Tooltip("amount:Q", title="Delta", format=",.0f"),
            alt.Tooltip("y:Q", title="Start", format=",.0f"),
            alt.Tooltip("y2:Q", title="End", format=",.0f"),
        ],
    )

    # Delta text labels.  Increases/baseline sit above the bar top; decreases
    # sit just below the bar bottom so they never overlap the bar fill.
    text_up = base.transform_filter('datum.bar_type != "decrease"').mark_text(
        fontSize=12, fontWeight="bold", dy=-8
    ).encode(
        x=x_encoding,
        y=alt.Y("y2:Q"),
        text=alt.Text("text_val:Q", format=",.0f"),
        color=alt.value("#222222"),
    )
    text_down = base.transform_filter('datum.bar_type == "decrease"').mark_text(
        fontSize=12, fontWeight="bold", dy=16
    ).encode(
        x=x_encoding,
        y=alt.Y("y2:Q"),
        text=alt.Text("text_val:Q", format=",.0f"),
        color=alt.value("#222222"),
    )

    chart = (bars + text_up + text_down).properties(
        title="Cash-Flow Waterfall Chart",
        width=720,
        height=420,
    )

    chart.save(OUTPUT_PATH)
    print(f"Waterfall chart written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()