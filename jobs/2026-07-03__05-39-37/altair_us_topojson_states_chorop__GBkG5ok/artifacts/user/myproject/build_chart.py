"""Build a US state-level choropleth of engineers using Vega-Altair.

The chart colors each state by the number of engineers (per capita) on a
``blues`` color scheme and renders as a self-contained HTML file.
"""

import jinja2

import altair as alt
from vega_datasets import data


# A custom HTML template that embeds the Vega-Lite spec inside a
# ``<script type="application/json">`` block and renders it with vegaEmbed,
# matching the standard Altair dependencies but using the JSON-block pattern.
JSON_TEMPLATE = jinja2.Template(
    """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    #{{ output_div }}.vega-embed {
      width: 100%;
      display: flex;
    }

    #{{ output_div }}.vega-embed details,
    #{{ output_div }}.vega-embed details summary {
      position: relative;
    }
  </style>
  <script type="text/javascript" src="{{ base_url }}/vega@{{ vega_version }}"></script>
  {%- if mode == 'vega-lite' %}
  <script type="text/javascript" src="{{ base_url }}/vega-lite@{{ vegalite_version }}"></script>
  {%- endif %}
  <script type="text/javascript" src="{{ base_url }}/vega-embed@{{ vegaembed_version }}"></script>
</head>
<body>
  <div id="{{ output_div }}"></div>
  <script type="application/json" id="vega-spec">{{ spec }}</script>
  <script type="text/javascript">
    (function(vegaEmbed) {
      var specElement = document.getElementById('vega-spec');
      var spec = JSON.parse(specElement.textContent);
      var embedOpt = {{ embed_options }};

      function showError(el, error){
          el.innerHTML = ('<div style="color:red;">'
                          + '<p>JavaScript Error: ' + error.message + '</p>'
                          + "<p>This usually means there's a typo in your chart specification. "
                          + "See the javascript console for the full traceback.</p>"
                          + '</div>');
          throw error;
      }
      const el = document.getElementById('{{ output_div }}');
      vegaEmbed("#{{ output_div }}", spec, embedOpt)
        .catch(error => showError(el, error));
    })(vegaEmbed);
  </script>
</body>
</html>
"""
)


def build_chart() -> alt.Chart:
    """Create the US engineers choropleth chart."""
    # US state geometries from the us-10m TopoJSON file.
    states = alt.topo_feature(data.us_10m.url, "states")

    # The population/engineers dataset keyed by the FIPS state id.
    source = data.population_engineers_hurricanes.url

    chart = (
        alt.Chart(states)
        .mark_geoshape()
        .transform_lookup(
            lookup="id",
            from_=alt.LookupData(
                source,
                key="id",
                fields=["engineers", "state"],
            ),
        )
        .encode(
            color=alt.Color(
                "engineers:Q",
                scale=alt.Scale(scheme="blues"),
                legend=alt.Legend(title="Engineers (per capita)"),
            ),
            tooltip=["state:N", "engineers:Q"],
        )
        .project(type="albersUsa")
        .properties(width=700, height=400, title="Engineers by US State")
    )

    return chart


def main() -> None:
    chart = build_chart()
    # Use chart.save with a custom Jinja2 template so the Vega-Lite spec is
    # embedded inside a <script type="application/json"> block.
    chart.save("chart.html", template=JSON_TEMPLATE)
    print("Saved chart to chart.html")


if __name__ == "__main__":
    main()