"""
Waterfall chart of sequential cash-flow deltas built with Vega-Altair (v5+).

Steps:
  1. Load cash_flow.csv with pandas (no remote URL).
  2. Add an integer `order` column so Altair can preserve row order on the x-axis.
  3. Use an Altair window transform to compute the running cumulative sum.
  4. Use calculate transforms to derive each bar's y / y2 positions, with
     special handling for the Begin and End baseline bars.
  5. Color-code bars: increase / decrease / total.
  6. Layer floating bars + delta text labels and export to waterfall.html.
"""

import pathlib
import pandas as pd
import altair as alt

# ---------------------------------------------------------------------------
# 1. Load the source data
# ---------------------------------------------------------------------------
PROJECT_DIR = pathlib.Path(__file__).parent
csv_path = PROJECT_DIR / "data" / "cash_flow.csv"

df = pd.read_csv(csv_path)

# Attach a stable integer order so Vega preserves the CSV row sequence.
df["order"] = range(len(df))

# ---------------------------------------------------------------------------
# 2. Build the Altair chart
# ---------------------------------------------------------------------------
base = alt.Chart(df).transform_window(
    # Running cumulative sum over the amount column, ordered by our row index.
    cumulative_sum="sum(amount)",
    sort=[alt.SortField("order")],
    frame=[None, 0],       # all rows from the start up to and including current
)

# -- Calculate transforms ------------------------------------------------
# `cumulative_sum` at row i is the sum of amount[0..i] (inclusive).
#
# For a normal step:
#   bar top    = cumulative_sum            (the new running total)
#   bar bottom = cumulative_sum - amount   (the previous running total)
#
# For the "Begin" bar (amount = 4000):
#   We want it to stand on 0 and reach 4000 → same formula works.
#
# For the "End" bar (amount = 0, but we want 0 → grand total):
#   cumulative_sum = grand total (since amount=0 doesn't change the sum).
#   We override: y = 0, y2 = cumulative_sum.
#   We detect this with label == "End".

base = base.transform_calculate(
    # Previous running total (= bar start for ordinary bars)
    prev_sum="datum.cumulative_sum - datum.amount",

    # Bar bottom: 0 for End/Begin totals, prev_sum otherwise
    bar_start=(
        "datum.label === 'End'   ? 0 "
        ": datum.label === 'Begin' ? 0 "
        ": datum.cumulative_sum - datum.amount"
    ),

    # Bar top: cumulative_sum for all bars (works for End because amount=0)
    bar_end="datum.cumulative_sum",

    # Color category
    bar_type=(
        "datum.label === 'Begin' || datum.label === 'End' ? 'Total' "
        ": datum.amount > 0 ? 'Increase' "
        ": 'Decrease'"
    ),

    # Display label: show the raw amount (signed) for delta bars,
    # and the grand total value for the End bar.
    label_text=(
        "datum.label === 'End' "
        "  ? format(datum.cumulative_sum, ',.0f') "
        "  : (datum.amount >= 0 ? '+' : '') + format(datum.amount, ',.0f')"
    ),
)

# ---------------------------------------------------------------------------
# 3. Shared encodings
# ---------------------------------------------------------------------------
x_enc = alt.X(
    "label:N",
    sort=alt.EncodingSortField(field="order", order="ascending"),
    axis=alt.Axis(labelAngle=0, title=None),
)

color_scale = alt.Scale(
    domain=["Increase", "Decrease", "Total"],
    range=["#3CA76E", "#E05C5C", "#5B8FD4"],   # green / red / blue
)

color_enc = alt.Color(
    "bar_type:N",
    scale=color_scale,
    legend=alt.Legend(title="Bar type"),
)

# ---------------------------------------------------------------------------
# 4. Bar layer
# ---------------------------------------------------------------------------
bars = base.mark_bar(
    cornerRadiusTopLeft=3,
    cornerRadiusTopRight=3,
    cornerRadiusBottomLeft=3,
    cornerRadiusBottomRight=3,
).encode(
    x=x_enc,
    y=alt.Y(
        "bar_start:Q",
        title="Cumulative balance",
        axis=alt.Axis(format=",.0f"),
    ),
    y2=alt.Y2("bar_end:Q"),
    color=color_enc,
    tooltip=[
        alt.Tooltip("label:N", title="Step"),
        alt.Tooltip("amount:Q", title="Delta", format="+,.0f"),
        alt.Tooltip("cumulative_sum:Q", title="Running total", format=",.0f"),
    ],
)

# ---------------------------------------------------------------------------
# 5. Text label layer
# ---------------------------------------------------------------------------
# Place the label just above the higher of the two bar endpoints.
text_labels = base.mark_text(
    baseline="bottom",
    dy=-4,
    fontSize=12,
    fontWeight="bold",
).encode(
    x=x_enc,
    # Anchor on the bar's *top* (= max of bar_start and bar_end)
    y=alt.Y(
        "bar_end:Q",
        title="",
    ),
    text=alt.Text("label_text:N"),
    color=alt.value("#333333"),
)

# ---------------------------------------------------------------------------
# 6. Layer and configure
# ---------------------------------------------------------------------------
chart = (
    alt.layer(bars, text_labels)
    .properties(
        title=alt.TitleParams(
            "Cash-Flow Waterfall",
            fontSize=18,
            fontWeight="bold",
            anchor="start",
            offset=10,
        ),
        width=600,
        height=380,
    )
    .configure_axis(
        grid=True,
        gridColor="#E8E8E8",
        labelFontSize=11,
        titleFontSize=13,
    )
    .configure_view(strokeWidth=0)
)

# ---------------------------------------------------------------------------
# 7. Export
# ---------------------------------------------------------------------------
out_path = PROJECT_DIR / "waterfall.html"
# inline=True embeds the Vega/Vega-Lite/Vega-Embed JS directly into the HTML
# so the file is fully self-contained and renders with no network access.
chart.save(str(out_path), inline=True)
print(f"Chart saved → {out_path}")
