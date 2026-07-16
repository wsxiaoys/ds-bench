# Grouped Confidence-Interval Chart with Vega-Altair

## Background
You are analyzing the results of a repeated-measures laboratory experiment. Four treatment groups (`A`, `B`, `C`, and `D`) were each measured many times, and the raw measurements are stored locally. Your job is to build a single, publication-quality statistical figure with the declarative visualization library Vega-Altair (imported as `alt`) that communicates both the raw spread of the data and the uncertainty of each group's mean.

The figure must be a **layered** chart that overlays three things per group:
1. The individual raw observations, horizontally **jittered** so overlapping points are visible.
2. The **mean** of each group, drawn as a prominent point marker.
3. An **error bar** spanning the **95% confidence interval of the mean** for each group.

The final chart must be saved as a standalone, self-contained **HTML** file.

## Requirements
- Read the experiment data from the local CSV file that already exists in the project (do NOT download any data or reference any remote URL).
- Produce one layered Altair chart with these three layers, all sharing a categorical x-axis of the treatment group and a quantitative y-axis of the measured response:
  - A raw-observations layer of individual data points that are jittered horizontally within each group so they do not perfectly overlap.
  - A mean layer that draws one point per group at that group's mean response.
  - An error-bar layer that shows the **95% bootstrapped confidence interval of the mean** for each group.
- The chart must cover all four groups (`A`, `B`, `C`, `D`).
- Save the composed chart to a standalone HTML file. The data must be embedded in the HTML (no external/remote data reference).

## Implementation Hints
- Project path: /home/user/altair-task
- Input data (already present): /home/user/altair-task/data/measurements.csv with columns `group` (categorical) and `response` (numeric). Each group has many rows.
- Use `alt.layer(...)` (or the `+` operator) to combine the three layers into one chart.
- For the error bar, `mark_errorbar` can aggregate raw data directly; the 95% confidence interval corresponds to the `"ci"` extent. (Equivalently, aggregating the response with `ci0`/`ci1` produces the same interval.)
- Horizontal jitter for the raw points is typically achieved with an x-offset driven by a random value (e.g. a calculated field feeding an offset channel).
- The mean layer is a point mark whose y encoding uses the mean aggregate of the response.
- Command (rerunnable): `python3 build_chart.py` — running it must (re)generate the HTML output.
- Output file: /home/user/altair-task/output/chart.html (a standalone HTML document containing the embedded Vega-Lite specification and the embedded data).

