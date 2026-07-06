"""Build a US state-level engineers choropleth using Vega-Altair.

The resulting chart is saved as chart.html (a self-contained, static HTML file
that renders in a browser) inside the project directory.

The Vega-Lite spec is embedded in a `<script type="application/json">` block and
rendered by vegaEmbed via a small inline renderer script.
"""

import json
from pathlib import Path

import altair as alt
from vega_datasets import data


# ---------------------------------------------------------------------------
# Data sources
# ---------------------------------------------------------------------------
# TopoJSON URL for US state geometries (features located at the 'states' layer).
states_url = data.us_10m.url

# CSV URL containing per-state engineer counts keyed by FIPS `id`.
population_url = data.population_engineers_hurricanes.url


# ---------------------------------------------------------------------------
# Build chart
# ---------------------------------------------------------------------------
chart = (
    alt.Chart(
        alt.topo_feature(states_url, feature="states"),
        title="US Engineers by State",
    )
    # Attach the engineers/state columns to each state geometry via FIPS id.
    .transform_lookup(
        lookup="id",
        from_=alt.LookupData(
            population_url,
            key="id",
            fields=["engineers", "state"],
        ),
    )
    # Render states as filled shapes, colored by the looked-up engineers field.
    .mark_geoshape(stroke="white", strokeWidth=0.5)
    .encode(
        color=alt.Color(
            "engineers:Q",
            title="Engineers",
            scale=alt.Scale(scheme="blues"),
            legend=alt.Legend(title="Engineers"),
        ),
        tooltip=[
            alt.Tooltip("state:N", title="State"),
            alt.Tooltip("engineers:Q", title="Engineers", format=".4f"),
        ],
    )
    # Alaska/Hawaii insets fit within the US extent.
    .project(type="albersUsa")
    .properties(width=700, height=400, title="US Engineers by State")
)

# Pull out the spec as a plain dict so we can embed it as application/json.
spec = chart.to_dict()


# ---------------------------------------------------------------------------
# HTML template
# ---------------------------------------------------------------------------
HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{title}</title>
  <style>
    body {{ font-family: sans-serif; margin: 16px; }}
    #vis.vega-embed {{ width: 100%; display: flex; }}
    #vis.vega-embed details,
    #vis.vega-embed details summary {{ position: relative; }}
  </style>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega@{vega_version}"></script>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega-lite@{vegalite_version}"></script>
  <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/vega-embed@{vegaembed_version}"></script>
</head>
<body>
  <div id="vis"></div>
  <script type="application/json" id="vega-lite-spec">
{spec_json}
  </script>
  <script type="text/javascript">
    (function() {{
      const spec = JSON.parse(
        document.getElementById('vega-lite-spec').textContent
      );
      const el = document.getElementById('vis');
      function showError(error) {{
        el.innerHTML = (
          '<div style="color:red;">' +
          '<p>JavaScript Error: ' + error.message + '</p>' +
          '<p>This usually means there is a typo in the chart specification. ' +
          'See the browser console for the full traceback.</p>' +
          '</div>'
        );
        throw error;
      }}
      vegaEmbed('#vis', spec, {{ mode: 'vega-lite' }}).catch(showError);
    }})();
  </script>
</body>
</html>
"""


def render_html(spec_dict, *, title="US Engineers Choropleth") -> str:
    return HTML_TEMPLATE.format(
        title=title,
        vega_version="6",
        vegalite_version="6.4.1",
        vegaembed_version="7",
        spec_json=json.dumps(spec_dict, indent=2),
    )


# ---------------------------------------------------------------------------
# Persist as a self-contained HTML file in the project directory.
# ---------------------------------------------------------------------------
def main() -> None:
    project_dir = Path(__file__).resolve().parent
    output_path = project_dir / "chart.html"
    output_path.write_text(render_html(spec), encoding="utf-8")
    print(f"Saved chart to {output_path}")


if __name__ == "__main__":
    main()
