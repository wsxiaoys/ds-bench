# Waterfall Chart of Sequential Cash-Flow Deltas with Vega-Altair

## Background
A finance team wants a waterfall chart that shows how a starting balance is transformed, step by step, into an ending balance by a sequence of signed deltas (revenues and costs). You will build this visualization with the declarative library Vega-Altair (v5+) and export it as a standalone, browser-renderable HTML file. All data is available locally; your solution must be fully self-contained and must not use any remote dataset URL or network call.

## Requirements
- Read the local input data and build a single **waterfall chart**: one floating bar per row, where each bar starts at the previous cumulative total and ends at the new cumulative total.
- Preserve the row order of the input on the x-axis (the categories must appear in the same order as the file; do not re-sort alphabetically).
- Use a **window transform** to compute the running cumulative sum of the delta amounts across the ordered rows.
- Use one or more **calculate transforms** to derive, for each bar, its start (`y`) and end (`y2`) positions from that cumulative sum.
- The last row (label `End`, whose input amount is `0`) must be rendered as the overall **total** bar spanning from `0` up to the grand total of all deltas.
- **Color-code** the bars into three visually distinct colors: one for increases (positive deltas), one for decreases (negative deltas), and one for the baseline/total bars (`Begin` and `End`).
- Add **text mark labels** on the chart that display each step's delta amount.
- Combine the bars and the text labels into a single layered Altair chart and export it as HTML.

## Implementation Hints
- Project path: /home/user/project
- Input data file: /home/user/project/data/cash_flow.csv (columns: `label`, `amount`; one row per step, already in display order; the last row is `End` with amount `0`).
- Command: `python3 generate_waterfall.py` (run from the project directory).
- The command must write the chart to `/home/user/project/waterfall.html` as a self-contained HTML page that renders in a browser (e.g. via `Chart.save(...)`).
- Load the CSV locally (e.g. with pandas) and pass the in-memory data to `alt.Chart`; do NOT reference any `http(s)` URL or `vega_datasets` remote source.
- A window `sum` over the `amount` field gives the running cumulative total; combine it with calculate transforms to obtain each bar's start and end. Remember the `End` row needs special handling so it spans from `0` to the grand total.
- Encode the bar with both `y` (start) and `y2` (end); drive the fill color from whether the step is an increase, a decrease, or a baseline/total bar so the three cases are distinguishable (at least three distinct colors).
- Keep everything in one layered chart so the exported HTML contains the bars and the delta text labels together.

