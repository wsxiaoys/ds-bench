"""Build a back-to-back population age pyramid with Vega-Altair.

This script constructs a single Altair ``bar`` chart (no faceting, no
concatenation) that renders the classic back-to-back age pyramid for the
canonical ``population`` dataset hosted by vega-datasets.

Males (``sex == 1``) extend to the left as negative bars and females
(``sex == 2``) extend to the right as positive bars.  The signed value is
computed *inside* the Vega-Lite spec via ``transform_calculate`` (never in
pandas).  A ``binding_select`` dropdown bound to a single ``alt.param`` lets
the viewer switch between census years; the chart is filtered to one year at
a time and defaults to ``1980``.

Running this module writes two artefacts next to this script:

* ``pyramid.html``       - the rendered, self-contained HTML chart
* ``pyramid_spec.json``  - the raw Vega-Lite spec (as returned by
  ``Chart.to_dict()``) for programmatic inspection
"""

from __future__ import annotations

import json
import os

import altair as alt
from altair.datasets import data


# Distinct census years present in vega-datasets ``population.json``.
# Hard-coded so the script works without network access at render time
# (Altair only embeds the data URL into the spec; it never fetches it).
YEARS: list[int] = [
    1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920,
    1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000,
]

# Initial year selected in the dropdown.
DEFAULT_YEAR = 1980

# Output location for the rendered artefacts.
OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def build_chart() -> alt.Chart:
    """Construct the back-to-back age pyramid Altair chart."""
    # The data source is the *URL string* (not a pre-loaded DataFrame) so the
    # encoding type shorthands (``:Q``, ``:O``, ``:N``) are required.
    data_url = data.population.url

    # A single alt.param bound to a dropdown controls the displayed year.
    year_param = alt.param(
        name="year",
        value=DEFAULT_YEAR,
        bind=alt.binding_select(options=YEARS, name="Year "),
    )

    chart = (
        alt.Chart(data_url)
        .mark_bar()
        .encode(
            x=alt.X(
                "people_signed:Q",
                title="Population",
                axis=alt.Axis(
                    # SI formatting such as "10M" ...
                    format="s",
                    # ... but display absolute values on both sides.
                    labelExpr="abs(datum.value)",
                ),
            ),
            # Oldest age at the top, youngest at the bottom.
            y=alt.Y("age:O", sort="descending", title="Age"),
            color=alt.Color(
                "sex:N",
                title="Sex",
                scale=alt.Scale(
                    domain=[1, 2],
                    range=["steelblue", "salmon"],
                ),
                legend=alt.Legend(
                    # The legend must show "Male"/"Female", not 1/2.
                    labelExpr="datum.value === 1 ? 'Male' : 'Female'",
                ),
            ),
            tooltip=[
                alt.Tooltip("year:O", title="Year"),
                alt.Tooltip("age:O", title="Age"),
                alt.Tooltip("sex:N", title="Sex"),
                alt.Tooltip("people:Q", title="People", format=","),
            ],
        )
        # The signed value lives *in the spec*: negative for males.
        .transform_calculate(
            people_signed="datum.sex === 1 ? -datum.people : datum.people"
        )
        # Filter to the single year chosen by the dropdown.
        .transform_filter("datum.year == year")
        .add_params(year_param)
        .properties(
            title="US Population Age Pyramid",
            width=650,
            height=450,
        )
    )
    return chart


def main() -> None:
    chart = build_chart()

    html_path = os.path.join(OUT_DIR, "pyramid.html")
    spec_path = os.path.join(OUT_DIR, "pyramid_spec.json")

    # Render the self-contained HTML (no network needed at render time).
    chart.save(html_path)

    # Persist the raw Vega-Lite spec for the verifier.
    spec = chart.to_dict()
    with open(spec_path, "w", encoding="utf-8") as fh:
        json.dump(spec, fh, indent=2)

    print(f"Wrote {html_path}")
    print(f"Wrote {spec_path}")


if __name__ == "__main__":
    main()