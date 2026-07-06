import altair as alt
from vega_datasets import data

def build_chart():
    # Use the seattle weather dataset URL
    source = data.seattle_weather.url

    # Create a base chart and calculate mean temperature and formatted strings
    base = alt.Chart(source).transform_calculate(
        temp_mean='(datum.temp_min + datum.temp_max) / 2',
        text_date="timeFormat(datum.date, '%b %d, %Y')",
        text_temp="'Mean Temp: ' + format((datum.temp_min + datum.temp_max) / 2, '.1f') + ' °C'",
        text_precip="'Precipitation: ' + format(datum.precipitation, '.1f') + ' mm'"
    )

    # 1. Pale-orange area chart for temperature range
    temp_area = base.mark_area(
        color='#ffe6cc',
        opacity=0.6
    ).encode(
        x=alt.X('date:T', title='Date'),
        y=alt.Y('temp_min:Q', title='Temperature (°C)'),
        y2='temp_max:Q'
    )

    # 2. Daily mean temperature line
    temp_line = base.mark_line(
        color='#e6550d',
        size=2
    ).encode(
        x='date:T',
        y='temp_mean:Q'
    )

    # 3. Precipitation bar series on secondary axis
    precip_bar = base.mark_bar(
        color='#9ecae1',
        opacity=0.6
    ).encode(
        x='date:T',
        y=alt.Y('precipitation:Q', title='Precipitation (mm)')
    )

    # 4. Zero degree rule
    zero_rule = base.mark_rule(
        color='#999999',
        strokeDash=[4, 4],
        size=1
    ).encode(
        y=alt.datum(0)
    )

    # 5. Nearest-x hover selection and interaction layers
    hover_selection = alt.selection_point(
        name='hover',
        on='pointerover',
        nearest=True,
        encodings=['x'],
        empty=False
    )

    # Transparent selector rule to capture hover events
    selector = base.mark_rule(
        color='transparent',
        strokeWidth=10
    ).encode(
        x='date:T'
    ).add_params(
        hover_selection
    )

    # Vertical line indicating the hovered date
    hover_rule = base.mark_rule(
        color='#555555',
        strokeWidth=1,
        strokeDash=[2, 2]
    ).encode(
        x='date:T',
        opacity=alt.when(hover_selection).then(alt.value(0.8)).otherwise(alt.value(0))
    )

    # Tooltip text displays
    tooltip_date = base.mark_text(
        align='left',
        dx=10,
        dy=-40,
        color='#333333',
        fontWeight='bold'
    ).encode(
        x='date:T',
        y='temp_mean:Q',
        text='text_date:N',
        opacity=alt.when(hover_selection).then(alt.value(1)).otherwise(alt.value(0))
    )

    tooltip_temp = base.mark_text(
        align='left',
        dx=10,
        dy=-25,
        color='#e6550d'
    ).encode(
        x='date:T',
        y='temp_mean:Q',
        text='text_temp:N',
        opacity=alt.when(hover_selection).then(alt.value(1)).otherwise(alt.value(0))
    )

    tooltip_precip = base.mark_text(
        align='left',
        dx=10,
        dy=-10,
        color='#3182bd'
    ).encode(
        x='date:T',
        y='temp_mean:Q',
        text='text_precip:N',
        opacity=alt.when(hover_selection).then(alt.value(1)).otherwise(alt.value(0))
    )

    # Layer all the components together
    chart = alt.layer(
        temp_area,
        temp_line,
        precip_bar,
        zero_rule,
        selector,
        hover_rule,
        tooltip_date,
        tooltip_temp,
        tooltip_precip
    ).resolve_scale(
        y='independent'
    ).properties(
        width=800,
        height=400,
        title='Seattle Weather: Temperature Range, Mean, and Precipitation'
    )

    # First save using chart.save to satisfy the requirement
    chart.save('/home/user/myproject/chart.html')
    print("Standard chart saved successfully.")

    # Get the JSON spec
    spec_json = chart.to_json(indent=2)

    # Create the custom HTML format with the spec embedded in a <script type="application/json"> block
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Seattle Weather: Temperature Range, Mean, and Precipitation</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 30px;
      background-color: #fafafa;
      display: flex;
      flex-direction: column;
      align-items: center;
    }}
    h1 {{
      color: #333;
      margin-bottom: 20px;
    }}
    #vis {{
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1);
    }}
  </style>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega@6"></script>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega-lite@6"></script>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega-embed@7"></script>
</head>
<body>
  <h1>Seattle Weather Visualization</h1>
  <div id="vis"></div>
  
  <!-- Embedded Vega-Lite spec in application/json script block -->
  <script type="application/json" id="vis-spec">
{spec_json}
  </script>

  <script type="text/javascript">
    const spec = JSON.parse(document.getElementById('vis-spec').textContent);
    vegaEmbed('#vis', spec, {{"mode": "vega-lite", "renderer": "canvas"}}).catch(console.error);
  </script>
</body>
</html>
"""

    # Overwrite chart.html with the compliant template
    with open('/home/user/myproject/chart.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    print("Compliant HTML with embedded <script type=\"application/json\"> saved successfully.")

if __name__ == '__main__':
    build_chart()
