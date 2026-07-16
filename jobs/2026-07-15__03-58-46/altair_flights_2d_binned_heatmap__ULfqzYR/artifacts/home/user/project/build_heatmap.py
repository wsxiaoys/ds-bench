"""
Flight Delay 2D Binned Heatmap with Value Overlay (Vega-Altair)
Generates a synthetic flights dataset and produces a layered heatmap
exported as a self-contained HTML file.
"""

import numpy as np
import pandas as pd
import altair as alt

# ---------------------------------------------------------------------------
# 1.  Reproducible synthetic dataset
# ---------------------------------------------------------------------------
rng = np.random.default_rng(42)

DAYS_ORDERED = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
FLIGHTS_PER_CELL = 40          # number of simulated flights per (hour, day) cell

# Base delay pattern: morning rush (6-9) and evening rush (16-20) are worse;
# overnight flights are slightly early; weekends are a bit worse overall.
records = []
for day_idx, day in enumerate(DAYS_ORDERED):
    weekend_penalty = 5 if day in ("Fri", "Sat", "Sun") else 0
    for hour in range(24):
        # Sinusoidal base delay: peaks around 18:00, troughs near 06:00
        base_delay = 12 * np.sin(np.pi * (hour - 6) / 18) + weekend_penalty
        # Add some hour-specific noise characteristics
        sigma = 8 + 4 * abs(np.sin(np.pi * hour / 12))
        delays = rng.normal(loc=base_delay, scale=sigma, size=FLIGHTS_PER_CELL)
        for d in delays:
            records.append({"hour": hour, "day": day, "delay": round(float(d), 2)})

flights = pd.DataFrame(records)

print(f"Dataset shape: {flights.shape}")
print(flights.head())

# ---------------------------------------------------------------------------
# 2.  Base chart  (data embedded inline via to_dict default)
# ---------------------------------------------------------------------------
base = alt.Chart(flights).properties(
    width=620,
    height=320,
    title=alt.TitleParams(
        text="Average Departure Delay by Hour and Day of Week",
        fontSize=16,
        anchor="middle",
    ),
)

# ---------------------------------------------------------------------------
# 3.  Layer 1 — rect heatmap
# ---------------------------------------------------------------------------
rect = base.mark_rect().encode(
    x=alt.X("hour:Q")
        .bin(maxbins=24)
        .title("Departure Hour")
        .axis(labelAngle=0),
    y=alt.Y("day:N")
        .sort(DAYS_ORDERED)
        .title("Day of Week"),
    color=alt.Color("mean(delay):Q")
        .scale(scheme="redyellowgreen", reverse=True)
        .title("Mean Delay (min)")
        .legend(gradientLength=200),
    tooltip=[
        alt.Tooltip("hour:Q", bin=True, title="Hour (bin start)"),
        alt.Tooltip("day:N", title="Day"),
        alt.Tooltip("mean(delay):Q", title="Mean Delay (min)", format=".1f"),
        alt.Tooltip("count():Q", title="Flights"),
    ],
)

# ---------------------------------------------------------------------------
# 4.  Layer 2 — text overlay (same aggregation so numbers match colors)
# ---------------------------------------------------------------------------
text = base.mark_text(fontSize=9, fontWeight="bold", color="black").encode(
    x=alt.X("hour:Q")
        .bin(maxbins=24)
        .title("Departure Hour"),
    y=alt.Y("day:N")
        .sort(DAYS_ORDERED)
        .title("Day of Week"),
    text=alt.Text("mean(delay):Q", format=".1f"),
)

# ---------------------------------------------------------------------------
# 5.  Layer and configure
# ---------------------------------------------------------------------------
chart = (
    alt.layer(rect, text)
    .configure_axis(labelFontSize=11, titleFontSize=12)
    .configure_view(strokeWidth=0)
)

# ---------------------------------------------------------------------------
# 6.  Save as self-contained HTML (data is inlined by default)
# ---------------------------------------------------------------------------
output_path = "/home/user/project/heatmap.html"
chart.save(output_path, embed_options={"renderer": "svg"})
print(f"\nHeatmap saved to: {output_path}")
