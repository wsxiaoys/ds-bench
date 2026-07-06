"""Layered Seattle weather chart built with Vega-Altair.

Produces a self-contained HTML file at /home/user/myproject/chart.html
that combines:
    1. mark_area  : pale-orange daily temperature range (temp_min -> temp_max)
    2. mark_line  : mean temperature derived via transform_calculate
    3. mark_bar   : daily precipitation on a secondary (independent) y axis
    4. mark_rule  : dashed annotation at y = 0 degrees C
    5. hover layer: nearest-x selection_point driving a vertical rule + tooltip text
"""

import altair as alt
from vega_datasets import data

# ---------------------------------------------------------------------------
# Data source: use the URL form so the resulting HTML is fully self-contained.
# ---------------------------------------------------------------------------
source = data.seattle_weather.url

# ---------------------------------------------------------------------------
# Hover selection: nearest-by-x, fires on pointerover, never "empty".
# ---------------------------------------------------------------------------
hover = alt.selection_point(
    on="pointerover",
    nearest=True,
    encodings=["x"],
    empty=False,
)

# ---------------------------------------------------------------------------
# Base chart with shared x encoding and a calculated mean-temperature field.
# The transform_calculate field "temp_mean" is reused by the line layer and
# by the tooltip text layer.
# ---------------------------------------------------------------------------
base = (
    alt.Chart(source)
    .transform_calculate(temp_mean="(datum.temp_min + datum.temp_max) / 2")
    .transform_calculate(
        tooltip_text=(
            "timeFormat(datum.date, '%b %d, %Y')"
            " + '   mean=' + format(datum.temp_mean, '.2f')"
            " + ' \u00b0C   precip=' + format(datum.precipitation, '.1f')"
            " + ' mm'"
        )
    )
    .encode(
        x=alt.X("date:T", title="Date"),
    )
)

# ---------------------------------------------------------------------------
# Layer 1 - pale orange area showing the daily temperature range.
# ---------------------------------------------------------------------------
area = base.mark_area(opacity=0.45, color="#FFB066").encode(
    y=alt.Y("temp_max:Q", title="Temperature (°C)"),
    y2=alt.Y2("temp_min:Q"),
)

# ---------------------------------------------------------------------------
# Layer 2 - mean temperature line.
# ---------------------------------------------------------------------------
line = base.mark_line(color="#B22222", size=1.5).encode(
    y=alt.Y("temp_mean:Q"),
)

# ---------------------------------------------------------------------------
# Layer 3 - daily precipitation as bars on an independent secondary y axis.
# ---------------------------------------------------------------------------
bars = base.mark_bar(opacity=0.55, color="#4682B4").encode(
    y=alt.Y(
        "precipitation:Q",
        title="Precipitation (mm)",
        axis=alt.Axis(orient="right", titleColor="#4682B4"),
    ),
)

# ---------------------------------------------------------------------------
# Layer 4 - dashed annotation rule at the constant data value y = 0.
# `alt.datum(0)` lets us encode a literal value rather than a field.
# ---------------------------------------------------------------------------
zero_rule = base.mark_rule(strokeDash=[4, 4], color="#444444", size=1.25).encode(
    y=alt.Y(datum=0),
)

# ---------------------------------------------------------------------------
# Layer 5 - hover-driven vertical rule + tooltip text.  Both gates on `hover`
# via alt.condition so they appear only when an x value is selected.
# ---------------------------------------------------------------------------
hover_rule = base.mark_rule(color="#222222", size=1).encode(
    opacity=alt.condition(hover, alt.value(1), alt.value(0)),
)

hover_text = base.mark_text(
    align="left",
    baseline="bottom",
    dx=6,
    dy=-6,
    color="#111111",
    fontSize=11,
).encode(
    y=alt.Y("temp_mean:Q"),
    text=alt.condition(hover, "tooltip_text:N", alt.value("")),
    opacity=alt.condition(hover, alt.value(1), alt.value(0)),
)

# ---------------------------------------------------------------------------
# Compose the layered chart.
#   * `resolve_scale(y="independent")` keeps the precipitation scale from
#     sharing the temperature scale.
#   * The hover selection is attached via `add_params` so it is wired to the
#     hover_rule and hover_text layers.
# ---------------------------------------------------------------------------
chart = (
    alt.layer(area, line, bars, zero_rule, hover_rule, hover_text)
    .resolve_scale(y="independent")
    .add_params(hover)
    .properties(
        title="Seattle Weather — Temperature Range, Mean, and Precipitation",
        width=900,
        height=420,
    )
)

# ---------------------------------------------------------------------------
# Save as a fully self-contained HTML file (Vega-Lite spec embedded and
# rendered via vegaEmbed in the browser).
# ---------------------------------------------------------------------------
output_path = "/home/user/myproject/chart.html"

# Build the Vega-Lite spec dictionary and render it through a small custom
# HTML template that places the spec inside a `<script type="application/json">`
# block (the standard Vega embedding pattern) and uses vegaEmbed to render.
import json
from pathlib import Path

spec_dict = chart.to_dict()

html_template = """<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Seattle Weather — Temperature Range, Mean, and Precipitation</title>
  <style>
    #vis.vega-embed { width: 100%; display: flex; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/vega@6"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@6.4.1"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@7"></script>
</head>
<body>
  <div id="vis"></div>
  <script type="application/json" id="vega-spec">
__SPEC__
  </script>
  <script>
    (function() {
      var spec = JSON.parse(document.getElementById('vega-spec').textContent);
      function showError(el, error) {
        el.innerHTML = ('<div style="color:red;">'
                        + '<p>JavaScript Error: ' + error.message + '</p>'
                        + "<p>This usually means there's a typo in your chart specification. "
                        + 'See the javascript console for the full traceback.</p>'
                        + '</div>');
        throw error;
      }
      vegaEmbed('#vis', spec, {'mode': 'vega-lite'}).catch(function(err) {
        showError(document.getElementById('vis'), err);
      });
    })();
  </script>
</body>
</html>
"""

Path(output_path).write_text(
    html_template.replace("__SPEC__", json.dumps(spec_dict, indent=2))
)
print(f"Saved layered Seattle-weather chart to {output_path}")