import json
import altair as alt
from vega_datasets import data

source = data.seattle_weather.url

# Base chart with explicit types and a calculated mean temperature field
base = alt.Chart(source).transform_calculate(
    temp_mean="(datum.temp_min + datum.temp_max) / 2"
).encode(
    x=alt.X('date:T', title='Date')
)

# Layer 1: pale-orange area for daily temperature range (temp_min -> temp_max)
area = base.mark_area(
    color='#fdd0a2',
    fillOpacity=0.55,
    stroke='darkorange',
    opacity=0.85
).encode(
    y=alt.Y('temp_max:Q', title='Temperature (°C)'),
    y2=alt.Y2('temp_min:Q')
)

# Layer 2: mean temperature line
line = base.mark_line(color='crimson', strokeWidth=2).encode(
    y=alt.Y('temp_mean:Q')
)

# Layer 3: precipitation bars on a secondary (independent) y axis
precip = base.mark_bar(color='steelblue', opacity=0.45).encode(
    y=alt.Y('precipitation:Q', axis=alt.Axis(title='Precipitation (mm)'))
)

# Layer 4: dashed annotation rule at y = 0 degrees C, spanning the full x range
zero_rule = base.mark_rule(
    strokeDash=[4, 4],
    color='black',
    opacity=0.6,
    strokeWidth=1.5
).encode(
    y=alt.Y(datum=0, type='quantitative')
)

# Layer 5: nearest-x hover interaction (selection_point)
hover = alt.selection_point(
    on='pointerover',
    nearest=True,
    encodings=['x'],
    empty=False
)

# Vertical rule that follows the hovered date
hover_rule = base.mark_rule(color='black', strokeWidth=1).encode(
    x=alt.X('date:T'),
    y=alt.Y(datum=-10, type='quantitative'),
    y2=alt.Y2(datum=35, type='quantitative'),
    opacity=alt.when(hover).then(alt.value(0.55)).otherwise(alt.value(0))
)

# Tooltip text displaying date, mean temperature, and precipitation for the hovered date
tooltip = (
    base
    .transform_calculate(
        label=(
            "timeFormat(datum.date, '%Y-%m-%d')"
            " + ' | Mean: ' + format(datum.temp_mean, '.1f') + '°C'"
            " + ' | Precip: ' + format(datum.precipitation, '.1f') + 'mm'"
        )
    )
    .mark_text(align='left', dx=5, dy=-12, fontSize=11, fontWeight='bold', color='black')
    .encode(
        x=alt.X('date:T'),
        y=alt.Y('temp_mean:Q'),
        text=alt.Text('label:N'),
        opacity=alt.when(hover).then(alt.value(1)).otherwise(alt.value(0))
    )
)

# Compose all layers; resolve y scale so precipitation has its own axis;
# wire the hover selection onto the chart that drives the hover-driven layers.
chart = alt.layer(
    area,
    line,
    precip,
    zero_rule,
    hover_rule,
    tooltip
).resolve_scale(
    y='independent'
).add_params(
    hover
).properties(
    width=900,
    height=420,
    title="Seattle Weather: Temperature Range, Mean and Precipitation"
)

# Serialize the chart spec to JSON
spec = chart.to_dict()
spec_json = json.dumps(spec, indent=2)

# Construct a self-contained HTML file with the spec embedded in a
# <script type="application/json"> block and rendered via vegaEmbed.
html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Seattle Weather Chart</title>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega@6"></script>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega-lite@6.4.1"></script>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega-embed@7"></script>
  <style>
    #vis.vega-embed {{ width: 100%; display: flex; }}
    #vis.vega-embed details,
    #vis.vega-embed details summary {{ position: relative; }}
    body {{ font-family: Arial, sans-serif; margin: 20px; }}
  </style>
</head>
<body>
  <h1>Seattle Weather: Temperature Range, Mean and Precipitation</h1>
  <div id="vis"></div>
  <script type="application/json" id="spec">
{spec_json}
  </script>
  <script type="text/javascript">
    (function() {{
      var spec = JSON.parse(document.getElementById('spec').textContent);
      var embedOpt = {{ "mode": "vega-lite" }};

      function showError(el, error) {{
          el.innerHTML = ('<div style="color:red;">'
                          + '<p>JavaScript Error: ' + error.message + '</p>'
                          + "<p>This usually means there's a typo in your chart specification. "
                          + "See the javascript console for the full traceback.</p>"
                          + '</div>');
          throw error;
      }}
      const el = document.getElementById('vis');
      vegaEmbed("#vis", spec, embedOpt).catch(error => showError(el, error));
    }})();
  </script>
</body>
</html>
"""

with open('/home/user/myproject/chart.html', 'w') as f:
    f.write(html)

print('Chart saved to /home/user/myproject/chart.html')
