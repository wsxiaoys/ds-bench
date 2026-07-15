"""Generate a layered Vega-Altair chart comparing LOESS and linear regression
trends for advertising spend vs. sales, broken down by region, with R^2 labels.

Outputs:
  - /home/user/altair_chart/output/chart.html  (standalone, data embedded inline)
  - /home/user/altair_chart/run.log           (single status line)
"""

import json
import os
from urllib.request import urlopen

import altair as alt
import pandas as pd


BASE_DIR = "/home/user/altair_chart"
DATA_PATH = os.path.join(BASE_DIR, "data", "marketing.csv")
OUTPUT_PATH = os.path.join(BASE_DIR, "output", "chart.html")
LOG_PATH = os.path.join(BASE_DIR, "run.log")


def _fetch_text(url: str) -> str:
    with urlopen(url, timeout=60) as resp:
        return resp.read().decode("utf-8")


def build_chart(df: pd.DataFrame) -> alt.Chart:
    """Build the layered Altair chart.

    Per region the chart layers:
      1. Raw scatter points
      2. LOESS smoothing line (solid)
      3. Linear regression line (dashed)
      4. Text annotation: ``R\u00b2 = <value>``
    """

    # Shared encodings for x/y so all layers share the same scales.
    base = alt.Chart(df).encode(
        x=alt.X("spend:Q", title="Advertising Spend"),
        y=alt.Y("sales:Q", title="Sales"),
        color=alt.Color("region:N", title="Region"),
    )

    # 1. Raw scatter points.
    points = base.mark_point(filled=True, size=60, opacity=0.55)

    # 2. LOESS smoothing line, grouped by region (solid).
    loess_line = base.mark_line(size=3).transform_loess(
        on="spend",
        loess="sales",
        groupby=["region"],
        bandwidth=0.4,
    )

    # 3. Linear regression line, grouped by region, drawn dashed.
    regression_line = base.mark_line(size=3, strokeDash=[8, 4]).transform_regression(
        on="spend",
        regression="sales",
        groupby=["region"],
        method="linear",
    )

    # 4. R^2 text annotation. The text content comes from the regression
    #    transform with ``params=True`` (which exposes ``rSquared``) and a
    #    ``calculate`` transform that formats it as ``R\u00b2 = 0.XX``.
    #    To place one label per region at the right end of the regression
    #    line, we aggregate the fitted (post-regression) spend/sales to
    #    their max per region and place the text there with a vertical
    #    offset so it sits above the line.
    r2_text = (
        alt.Chart(df)
        .mark_text(align="left", baseline="bottom", dx=6, dy=-6, fontSize=13)
        .encode(
            x=alt.X("spend:Q", aggregate="max", title="Advertising Spend"),
            y=alt.Y("sales:Q", aggregate="max", title="Sales"),
            color=alt.Color("region:N", title="Region"),
            text=alt.Text("r2_label:N"),
        )
        .transform_regression(
            on="spend",
            regression="sales",
            groupby=["region"],
            method="linear",
            params=True,
        )
        .transform_calculate(
            r2_label='"R\u00b2 = " + format(datum.rSquared, ".2f")',
        )
    )

    layered = (
        alt.layer(points, loess_line, regression_line, r2_text)
        .properties(
            title=(
                "Advertising Spend vs. Sales by Region: "
                "LOESS vs. Linear Regression"
            ),
            width=720,
            height=480,
        )
        .configure_legend(titleFontSize=12, labelFontSize=11)
    )

    return layered


def write_standalone_html(spec: dict, output_path: str) -> None:
    """Serialize a Vega-Lite spec to a self-contained HTML file.

    The HTML inlines Vega, Vega-Lite, and Vega-Embed so it renders without
    any network access. The dataset is embedded inline in the spec itself
    (the caller is responsible for that).
    """

    vega_js = _fetch_text("https://cdn.jsdelivr.net/npm/vega@5/build/vega.min.js")
    vegalite_js = _fetch_text(
        "https://cdn.jsdelivr.net/npm/vega-lite@5/build/vega-lite.min.js"
    )
    vegaembed_js = _fetch_text(
        "https://cdn.jsdelivr.net/npm/vega-embed@6/build/vega-embed.min.js"
    )

    spec_json = json.dumps(spec, ensure_ascii=False)

    html = (
        "<!DOCTYPE html>\n"
        "<html>\n"
        "<head>\n"
        "  <meta charset=\"utf-8\">\n"
        "  <title>LOESS vs. Linear Regression: Spend vs. Sales by Region</title>\n"
        f"  <script type=\"text/javascript\">{vega_js}</script>\n"
        f"  <script type=\"text/javascript\">{vegalite_js}</script>\n"
        f"  <script type=\"text/javascript\">{vegaembed_js}</script>\n"
        "  <style>body{font-family:sans-serif;margin:24px;}</style>\n"
        "</head>\n"
        "<body>\n"
        "  <div id=\"vis\"></div>\n"
        "  <script type=\"text/javascript\">\n"
        "    (function() {\n"
        "      var spec = " + spec_json + ";\n"
        "      function render() {\n"
        "        if (typeof vegaEmbed !== 'function') {\n"
        "          return setTimeout(render, 30);\n"
        "        }\n"
        "        vegaEmbed('#vis', spec, {renderer: 'canvas'}).catch("
        "function(err){document.getElementById('vis').innerText = "
        "'Render error: ' + (err && err.message ? err.message : err);});\n"
        "      }\n"
        "      render();\n"
        "    })();\n"
        "  </script>\n"
        "</body>\n"
        "</html>\n"
    )

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)


def main() -> None:
    df = pd.read_csv(DATA_PATH)

    chart = build_chart(df)

    # Serialize to a Vega-Lite dict so we can rewrite the data section to be
    # fully inline (no file path, no URL).
    spec = chart.to_dict()

    # Embed the raw dataframe as inline values so the chart renders offline.
    spec["data"] = {"values": df.to_dict(orient="records")}

    # Each layer in the chart references the parent dataset name. When we
    # inline the data, we strip the dataset references from each layer so
    # they fall back to the top-level ``data`` value.
    def _strip_data_refs(node):
        if isinstance(node, dict):
            if "data" in node and isinstance(node["data"], dict) and "name" in node["data"]:
                del node["data"]
            for v in node.values():
                _strip_data_refs(v)
        elif isinstance(node, list):
            for v in node:
                _strip_data_refs(v)

    _strip_data_refs(spec)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    write_standalone_html(spec, OUTPUT_PATH)

    log_line = f"Chart saved: {OUTPUT_PATH}"
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        f.write(log_line + "\n")

    print(log_line)


if __name__ == "__main__":
    main()