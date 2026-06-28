# Iris Species Dropdown Highlight with Vega-Altair

## Background
Build an interactive Vega-Altair scatter plot of the classic iris dataset that uses a bound dropdown widget to highlight one species at a time. Non-matching points are visually de-emphasized by being colored `lightgray`, while points belonging to the species selected in the dropdown keep their normal species color. The resulting chart must be exported as a single self-contained HTML file that fully renders in a browser.

## Requirements
- Write your code in `/home/user/myproject/build_chart.py` so it can be executed as `python3 build_chart.py`.
- Use `data.iris.url` from `vega_datasets` as the data source (URL-based source; declare encoding types explicitly).
- Build a scatter plot with `sepalLength` on the x axis and `sepalWidth` on the y axis, encoded as quantitative.
- Render the data using a point/circle mark.
- Define a single bound input parameter using `alt.binding_select` with:
  - `options=['setosa', 'versicolor', 'virginica']`
  - `name='Species: '`
- Bind that input to a parameter created with `alt.param(...)` whose `bind=` is the dropdown.
- Attach the parameter to the chart via `add_params(...)`.
- Use `alt.when(...).then(...).otherwise(...)` to drive the `color` encoding:
  - When `datum.species` matches the parameter's value, color the point using the species nominal field (i.e. `species:N`).
  - Otherwise, color the point with the constant `lightgray`.
- Save the resulting chart as a single self-contained HTML file named `chart.html` in `/home/user/myproject` to `/home/user/myproject/chart.html` using `chart.save(...)`.
- Name your script `build_chart.py` in `/home/user/myproject` so it can be run via `python3 build_chart.py`.

## Implementation Hints
- Remember that URL-based data requires explicit type shorthands (e.g. `sepalLength:Q`, `species:N`).
- `alt.binding_select` defines the dropdown widget; `alt.param(bind=...)` exposes its value as a Vega expression you can reference from `alt.when(...)`.
- The conditional predicate compares the data field `species` against the value of the bound parameter; use a Vega expression string like `"datum.species == <param-name>"`, where `<param-name>` is `param.name` of your bound parameter.
- `alt.when(predicate).then(alt.Color('species:N')).otherwise(alt.value('lightgray'))` is one idiomatic way to express the highlight.
- Initialize the parameter with a sensible default value (e.g. `'setosa'`) so the chart renders correctly before the user touches the dropdown.

