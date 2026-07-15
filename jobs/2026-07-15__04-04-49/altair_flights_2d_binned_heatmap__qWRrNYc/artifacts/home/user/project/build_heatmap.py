"""
Flight Delay 2D Binned Heatmap with Value Overlay (Vega-Altair).

Builds an in-memory flights dataset, constructs a layered Altair chart
(rect heatmap + text overlay) summarizing the mean departure delay for
each (binned departure hour, day of week) cell, and exports it as a
self-contained HTML file with the data embedded inline.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import altair as alt


# ---------------------------------------------------------------------------
# 1. Build the flights dataset in memory.
# ---------------------------------------------------------------------------
# We generate many flights for every (hour, day) combination so that the
# heatmap is fully populated. The delay distribution is shaped to mimic
# realistic patterns: early/late-night flights tend to leave closer to
# schedule (or slightly early), mid-day and evening flights trend a bit
# later, and a particular day gets a small extra delay bump for
# interesting variation.
np.random.seed(42)

HOURS = list(range(24))
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

rows = []
for day in DAYS:
    # Per-day bias (minutes) to give the heatmap some day-to-day structure.
    day_bias = {
        "Mon":  5.0,
        "Tue":  1.0,
        "Wed":  0.0,
        "Thu":  2.0,
        "Fri":  8.0,
        "Sat": -3.0,
        "Sun":  6.0,
    }[day]

    for hour in HOURS:
        # Per-hour bias: night/early hours ~ on time, peak hours a bit late.
        if 0 <= hour <= 5:
            hour_bias = -2.0
        elif 6 <= hour <= 9:
            hour_bias = 4.0
        elif 10 <= hour <= 14:
            hour_bias = 2.0
        elif 15 <= hour <= 19:
            hour_bias = 7.0
        else:
            hour_bias = 3.0

        n_flights = 80  # many flights per cell => fully populated heatmap
        delays = np.random.normal(
            loc=hour_bias + day_bias,
            scale=8.0,
            size=n_flights,
        )

        for d in delays:
            rows.append({"hour": int(hour), "day": day, "delay": float(d)})

flights = pd.DataFrame(rows, columns=["hour", "day", "delay"])

# Make `day` a stable ordered categorical so the y axis renders Mon..Sun.
flights["day"] = pd.Categorical(flights["day"], categories=DAYS, ordered=True)


# ---------------------------------------------------------------------------
# 2. Build the layered chart.
# ---------------------------------------------------------------------------
# A common aggregation is shared by both layers so the printed number in
# the text overlay matches the cell color in the heatmap.

base = (
    alt.Chart(flights)
    .transform_aggregate(
        mean_delay="mean(delay)",
        groupby=["hours(HOURS):T", "day"],
    )
)

heatmap = base.mark_rect().encode(
    x=alt.X("hours(HOURS):O")
        .bin(maxbins=24)
        .title("Departure Hour"),
    y=alt.Y("day:O").title("Day of Week"),
    color=alt.Color("mean_delay:Q")
        .scale(scheme="redblue", reverse=True, domainMid=0)
        .title("Mean delay (min)"),
    tooltip=[
        alt.Tooltip("hours(HOURS):O", bin=True, title="Departure Hour"),
        alt.Tooltip("day:O", title="Day of Week"),
        alt.Tooltip("mean_delay:Q", format=".1f", title="Mean delay (min)"),
    ],
)

text = base.mark_text(baseline="middle", fontSize=11).encode(
    x=alt.X("hours(HOURS):O").bin(maxbins=24),
    y=alt.Y("day:O"),
    text=alt.Text("mean_delay:Q", format=".1f"),
    color=alt.condition(
        "abs(datum.mean_delay) < 6",
        alt.value("black"),
        alt.value("white"),
    ),
)

chart = (heatmap + text).properties(
    title="Average Departure Delay by Hour and Day of Week",
    width=720,
    height=260,
).configure_view(stroke=None)


# ---------------------------------------------------------------------------
# 3. Export to a self-contained HTML file with the data embedded inline.
# ---------------------------------------------------------------------------
OUTPUT_PATH = "/home/user/project/heatmap.html"

# Inline the data: pass the DataFrame via `.transform_lookup` is not needed
# here because Altair's default `Chart` behavior embeds small inline
# datasets. To guarantee a fully self-contained spec with NO remote URL we
# use `alt.data_transformers.enable('default')` (which keeps data inline
# for normal-sized frames) and rely on `chart.save(..., inline=True)`.
alt.data_transformers.enable("default")
chart.save(OUTPUT_PATH, format="html", inline=True)

print(f"Wrote {OUTPUT_PATH} with {len(flights):,} flights.")
