# Flight Delay 2D Binned Heatmap with Value Overlay (Vega-Altair)

## Background
An airline operations team wants a single-figure summary of how average departure delay varies by the *time of day* a flight leaves versus the *day of the week*. You will build this visualization with the declarative Vega-Altair library and export it as a self-contained HTML file. The dataset must be generated locally inside your program — this environment has no internet access, so remote dataset URLs and network data sources are forbidden.

## Requirements
- Programmatically build a flights dataset in memory (a pandas DataFrame) with exactly these three columns:
  - `hour`: integer departure hour of day, values in the range 0–23.
  - `day`: the day of the week the flight departs (a categorical/string label such as `Mon`, `Tue`, ...).
  - `delay`: the flight's departure delay in minutes (numeric, may be negative for early departures).
  - The dataset must contain many flights spread across every combination of `hour` and `day` so the heatmap is fully populated.
- Build ONE layered Altair chart made of two layers over the same data:
  - A `mark_rect` heatmap where the x channel is the **binned** `hour`, the y channel is `day`, and the fill color encodes the **mean** of `delay`.
  - A `mark_text` layer drawn on top of the rectangles that prints the **mean** `delay` value inside each cell.
- The color encoding must use a named color scheme, and both the x and y axes must have human-readable titles.
- Export the finished chart to a self-contained HTML file using Altair's save mechanism.

## Implementation Hints
- Use Altair 5 method-based channel syntax: `alt.X('hour').bin(...)`, an aggregate such as `mean(delay)` for the color channel, and `alt.Color(...).scale(scheme=...)` to set the color scheme.
- Both the rectangle layer and the text layer must aggregate `delay` with the mean operation so the printed number matches the cell color; layering the two marks over the same encoding produces the value overlay.
- Keep all data inline: construct the DataFrame in Python and pass it directly to `alt.Chart(...)`. Do NOT reference any `http(s)` URL or `vega_datasets` remote data — the saved spec must embed the data inline.
- Axis titles: give the x axis a title like `Departure Hour` and the y axis a title like `Day of Week`.
- Project path: /home/user/project
- Command: `python3 build_heatmap.py`
- Output HTML file: /home/user/project/heatmap.html
- Running the command must (re)generate the data, build the layered chart, and write the HTML file. The resulting HTML must contain an embedded Vega-Lite specification whose data is inline (no remote URL).

