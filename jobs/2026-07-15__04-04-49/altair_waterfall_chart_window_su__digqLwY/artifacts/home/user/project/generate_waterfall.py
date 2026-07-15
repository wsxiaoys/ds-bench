"""Generate a waterfall chart of sequential cash-flow deltas with Vega-Altair.

Loads the local CSV `data/cash_flow.csv`, derives each row's running
cumulative total via a window transform, computes each bar's start/end
positions plus its color category via calculate transforms, and finally
layers floating bars with text labels of the delta amounts.  The chart is
written to `waterfall.html` as a self-contained, browser-renderable file.
"""

from __future__ import annotations

import os

import altair as alt
import pandas as pd


HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, "data", "cash_flow.csv")
OUT_PATH = os.path.join(HERE, "waterfall.html")


def build_waterfall(df: pd.DataFrame) -> alt.Chart:
    """Return a layered Altair waterfall chart for the given cash-flow frame."""

    # Keep an explicit row-index column so the window transform follows the
    # file's natural order instead of alphabetically re-sorting the labels.
    df = df.reset_index(drop=True).rename_axis("row_index").reset_index()

    # Python-side snapshot of the label order for the x-axis encoding.
    label_order = list(df["label"])

    base = alt.Chart(df, title="Sequential Cash-Flow Waterfall")

    # 1. Window transform: cumulative sum of `amount`, following the original
    #    row order.
    windowed = base.transform_window(
        cumulative="sum(amount)",
        sort=[{"field": "row_index", "order": "ascending"}],
    )

    # 2a. Calculate transforms: each bar's y (start) and y2 (end).
    #     For the special `End` row we span from 0 up to the grand total
    #     (which is the cumulative through the final row) rather than from
    #     `cumulative - amount` (which would collapse to a zero-height bar).
    positioned = windowed.transform_calculate(
        y_start="datum.label === 'End' ? 0 : datum.cumulative - datum.amount",
        y_end="datum.cumulative",
    )

    # 2b. Calculate transform: explicit three-way category used to drive the
    #     color encoding (increase / decrease / total-baseline).
    categorized = positioned.transform_calculate(
        category=(
            "(datum.label === 'Begin' || datum.label === 'End') "
            "? 'total' : (datum.amount > 0 ? 'increase' : 'decrease')"
        ),
    )

    # 3. Three visually distinct colors: green / red / neutral gray.
    color_scale = alt.Scale(
        domain=["increase", "decrease", "total"],
        range=["#2ca02c", "#d62728", "#7f7f7f"],
    )

    # 4. Floating-bar mark anchored with both y and y2.
    bars = categorized.mark_bar(size=42).encode(
        x=alt.X(
            "label:N",
            sort=label_order,
            axis=alt.Axis(title="Step", labelAngle=0),
        ),
        y=alt.Y(
            "y_start:Q",
            axis=alt.Axis(title="Balance"),
            scale=alt.Scale(zero=True, nice=True),
        ),
        y2=alt.Y2("y_end:Q"),
        color=alt.Color(
            "category:N",
            scale=color_scale,
            legend=alt.Legend(
                title="Type",
                values=["increase", "decrease", "total"],
                labelExpr=(
                    "{'increase':'Increase',"
                    " 'decrease':'Decrease',"
                    " 'total':'Baseline / Total'}[datum.value]"
                ),
            ),
        ),
        tooltip=[
            alt.Tooltip("label:N", title="Step"),
            alt.Tooltip("amount:Q", title="Delta"),
        ],
    )

    # 5. Text mark: each step's delta amount, with the End row using the
    #    grand total (its raw `amount` is 0).
    deltas = categorized.transform_calculate(
        label_text="datum.label === 'End' ? datum.cumulative : datum.amount",
    )
    text = deltas.mark_text(
        align="center", baseline="bottom", dy=-4, fontSize=12, color="black"
    ).encode(
        x=alt.X("label:N", sort=label_order),
        y=alt.Y("y2:Q"),
        text=alt.Text("label_text:Q", format=",.0f"),
    )

    # 6. Combine bars and text into a single layered chart so the exported
    #    HTML contains both.
    chart = (
        alt.layer(bars, text)
        .configure_axis(labelFontSize=12, titleFontSize=13)
        .properties(width=720, height=420)
    )
    return chart


def main() -> None:
    df = pd.read_csv(CSV_PATH)
    chart = build_waterfall(df)
    chart.save(OUT_PATH, format="html")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
