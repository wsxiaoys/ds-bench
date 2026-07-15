# Layered LOESS + Regression Trend Overlay with R² Annotation (Vega-Altair)

## Background
A marketing analytics team wants a single, self-contained chart that compares a non-parametric LOESS smoother against a parametric linear regression trend for advertising spend vs. sales, broken down by region, and clearly labels how well the linear model fits each region.

## Requirements
- Read the bundled local dataset and build a single layered Vega-Altair chart containing, per region: the raw scatter points, a LOESS smoothing line, a linear regression trend line that is visually distinct from the LOESS line, and a text annotation of the regression R².
- Save the chart as a standalone HTML file that renders fully offline: the dataset must be embedded inline in the Vega-Lite spec, and the spec must not reference the CSV file or any remote/CDN data URL.

## Implementation Hints
- Use Altair's `transform_loess` and `transform_regression`, both grouped by region.
- Use the `params` option of `transform_regression` to obtain the coefficient of determination (`rSquared`) and turn it into a text label with a calculate transform.
- Make the two trend lines easy to tell apart: draw the regression line dashed (via `strokeDash`) and the LOESS line solid.
- Project path: /home/user/altair_chart
- Input data: /home/user/altair_chart/data/marketing.csv with columns `spend` (numeric), `sales` (numeric), and `region` (string). The three regions are `North`, `South`, and `West`.
- Output HTML: /home/user/altair_chart/output/chart.html — it must be a standalone file that renders without any network access, so the data has to be embedded inline in the Vega-Lite spec (do not point the spec at the CSV path or any URL).
- The layered spec must contain at least these four kinds of layers: (1) a `point` or `circle` mark for the raw data, (2) a `line` mark produced by a LOESS transform, (3) a `line` mark produced by a regression transform and drawn dashed (a `strokeDash` on the line), and (4) a `text` mark whose content is derived from a regression transform run with `params` enabled.
- Both the LOESS and the regression transforms must group by `region`, and the regression must use the linear method.
- Each region's R² annotation text must be formatted exactly as `R² = <value>`, where `<value>` is that region's regression coefficient of determination rounded to exactly two decimal places (for example `R² = 0.80`). There must be exactly one such label per region.
- After saving the HTML, write the single line `Chart saved: /home/user/altair_chart/output/chart.html` to the log file /home/user/altair_chart/run.log.
- Ensure the generation script is actually executed so that both the HTML artifact and the log file exist.

