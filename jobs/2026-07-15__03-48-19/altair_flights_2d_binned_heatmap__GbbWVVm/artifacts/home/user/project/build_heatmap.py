"""
Build a 2D binned heatmap of average departure delay by hour-of-day and day-of-week.

The script:
  1. Generates a synthetic flights dataset in memory (pandas DataFrame).
  2. Builds a layered Altair chart:
       - mark_rect heatmap (binned hour x day, color = mean delay)
       - mark_text overlay printing the mean delay in each cell
  3. Exports the chart to a self-contained HTML file with inline data.

Run:  python3 build_heatmap.py
Out:  /home/user/project/heatmap.html
"""

import random
from pathlib import Path

import altair as alt
import pandas as pd

# Disable Altair's max-rows safety limit so the inline data is always embedded
# directly in the spec rather than being treated as a "large" dataset.
alt.data_transformers.disable_max_rows()

OUTPUT_FILE = Path(__file__).resolve().parent / "heatmap.html"

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def generate_flights(n_per_cell: int = 40, seed: int = 7) -> pd.DataFrame:
    """Generate a synthetic flights DataFrame.

    Every combination of hour (0-23) and day (Mon..Sun) is populated with
    ``n_per_cell`` flights so the heatmap is fully filled.  The delay values
    follow a realistic pattern: later hours and weekend days tend to be more
    delayed, with some randomness and negative (early) departures.
    """
    rng = random.Random(seed)

    rows = []
    for hour in range(24):
        # Baseline delay grows through the day, peaks in the evening.
        hour_baseline = -5 + 0.9 * hour
        for day_idx, day in enumerate(DAYS):
            # Weekend (Fri/Sat/Sun) extra delay.
            weekend_boost = 8.0 if day in ("Fri", "Sat", "Sun") else 0.0
            for _ in range(n_per_cell):
                noise = rng.gauss(0, 8)
                delay = round(hour_baseline + weekend_boost + noise, 1)
                rows.append({"hour": hour, "day": day, "delay": delay})

    df = pd.DataFrame(rows, columns=["hour", "day", "delay"])

    # Make `day` an ordered categorical so the y-axis follows calendar order.
    df["day"] = pd.Categorical(df["day"], categories=DAYS, ordered=True)
    return df


def build_chart(df: pd.DataFrame) -> alt.LayerChart:
    """Build the layered heatmap + text-overlay chart."""

    # Shared encodings so the two layers are perfectly aligned.
    x = alt.X("hour:Q").bin(maxbins=24, step=1).title("Departure Hour")
    y = alt.Y("day:N").sort(DAYS).title("Day of Week")

    color = alt.Color("mean(delay):Q").scale(
        scheme="redyellowblue", domainMid=0
    ).title("Mean Delay (min)")

    # Layer 1: the heatmap rectangles.
    heatmap = alt.Chart(df).mark_rect(stroke="white").encode(x=x, y=y, color=color)

    # Layer 2: the text overlay printing the mean delay in every cell.
    text = alt.Chart(df).mark_text(baseline="middle", fontSize=9).encode(
        x=x,
        y=y,
        text=alt.Text("mean(delay):Q", format=".1f"),
        # Vary text color for readability against light/dark cells.
        color=alt.condition(
            alt.datum["mean_delay"] > 15,
            alt.value("white"),
            alt.value("black"),
        ),
    )

    return (heatmap + text).properties(
        title="Average Departure Delay by Hour and Day of Week",
        width=640,
        height=240,
    )


def main() -> None:
    df = generate_flights()
    chart = build_chart(df)
    chart.save(str(OUTPUT_FILE))
    print(f"Wrote {OUTPUT_FILE} ({OUTPUT_FILE.stat().st_size} bytes)")


if __name__ == "__main__":
    main()