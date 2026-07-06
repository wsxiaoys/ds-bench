"""Build a back-to-back US population age pyramid with Vega-Altair.

This script constructs a single Altair bar chart (no faceting, no
horizontal concatenation) that renders the classic population pyramid:

  * Males (sex == 1) are drawn as negative bars extending to the left.
  * Females (sex == 2) are drawn as positive bars extending to the right.
  * A ``binding_select`` dropdown bound to a single ``alt.param`` lets the
    viewer pick the census year (initially 1980).

The signed value used for the x axis is computed *inside* the Vega-Lite
spec via a ``transform_calculate`` step (not pre-computed in pandas), and
the x axis labels are displayed as absolute values through an axis
``labelExpr``.

Running this script writes two artefacts next to it:

  * ``pyramid.html``       -- the embedded chart (produced by ``Chart.save``).
  * ``pyramid_spec.json``  -- the raw Vega-Lite spec (``Chart.to_dict``).

No network access is required at render time: Altair only embeds the dataset
URL string into the spec, it does not fetch the data when producing the HTML.
"""

from __future__ import annotations

import json
from pathlib import Path

import altair as alt
from altair.datasets import data

# Output location -- everything is written next to this script.
OUT_DIR = Path(__file__).resolve().parent
HTML_PATH = OUT_DIR / "pyramid.html"
SPEC_PATH = OUT_DIR / "pyramid_spec.json"

# Distinct census years present in the canonical population dataset
# (https://vega.github.io/vega-datasets/data/population.json). The 1890
# census records were destroyed, so that year is intentionally absent.
# These are hard-coded so the script can build the spec without any network
# access at render time.
YEARS = [
    1850, 1860, 1870, 1880,
    1900, 1910, 1920, 1930, 1940,
    1950, 1960, 1970, 1980, 1990, 2000,
]

# The initial year selected by the dropdown.
INITIAL_YEAR = 1980

# Colour mapping for the two sexes: 1 -> Male (steelblue), 2 -> Female (salmon).
SEX_DOMAIN = [1, 2]
SEX_RANGE = ["steelblue", "salmon"]


def build_chart() -> alt.Chart:
    """Build the back-to-back population pyramid Altair chart."""

    # The data source is the *URL string* for the population dataset, taken
    # from ``altair.datasets`` (``data.population.url``). Using a URL means
    # Altair only embeds the URL into the spec -- no fetching is required to
    # produce the HTML, so the script runs offline at render time. Because the
    # data is not a local DataFrame, encoding type shorthands (``:Q``, ``:O``,
    # ``:N``) are required.
    source = data.population.url

    # A single alt.param bound to a binding_select dropdown. The dropdown's
    # options are the distinct census years present in the dataset, and the
    # initial value is 1980. The param is referenced by name (``year``) inside
    # the transform_filter expression below.
    year_param = alt.param(
        name="year",
        value=INITIAL_YEAR,
        bind=alt.binding_select(options=YEARS, name="Year"),
    )

    chart = (
        alt.Chart(source)
        .mark_bar()
        .add_params(year_param)
        # Filter the data down to the single year chosen by the dropdown.
        # ``year`` (without ``datum.``) resolves to the parameter's value.
        .transform_filter("datum.year == year")
        # Compute the signed population *inside* the spec. Males (sex == 1)
        # get a negative value so their bars extend to the left of zero;
        # females (sex == 2) keep the positive value. This field is *not*
        # pre-computed in pandas -- it lives entirely in the Vega-Lite spec.
        .transform_calculate(
            signed_people="datum.sex === 1 ? -datum.people : datum.people"
        )
        .encode(
            # x axis: signed value. The axis uses an SI format and a
            # ``labelExpr`` that takes the absolute value of each tick so the
            # labels read ``10M`` on both sides rather than ``-10M`` on the
            # left. ``format(abs(datum.value), "s")`` keeps the SI suffix
            # while stripping the sign.
            x=alt.X(
                "signed_people:Q",
                title="Population",
                axis=alt.Axis(
                    format="s",
                    labelExpr='format(abs(datum.value), "s")',
                ),
            ),
            # y axis: age buckets as an ordinal field. ``sort='descending'``
            # flips the natural ascending order so the largest age (90) sits
            # at the top of the chart and the youngest (0) at the bottom.
            y=alt.Y(
                "age:O",
                sort="descending",
                title="Age",
            ),
            # Color encodes sex as a nominal field with an explicit scale
            # (domain [1, 2] -> [steelblue, salmon]). The legend's
            # ``labelExpr`` maps the raw integer values to the words
            # "Male" / "Female" so the legend never shows the raw 1 / 2.
            color=alt.Color(
                "sex:N",
                scale=alt.Scale(domain=SEX_DOMAIN, range=SEX_RANGE),
                legend=alt.Legend(
                    title="Sex",
                    labelExpr='datum.value == 1 ? "Male" : "Female"',
                ),
            ),
            # A bit of visual polish: a thin white gap between adjacent age
            # buckets so the two sides read as discrete bars.
            tooltip=[
                alt.Tooltip("year:Q", title="Year"),
                alt.Tooltip("age:O", title="Age"),
                alt.Tooltip("sex:N", title="Sex"),
                alt.Tooltip("people:Q", title="People", format=","),
            ],
        )
        .properties(
            title="US Population Age Pyramid by Census Year",
            width=480,
            height=400,
        )
    )

    return chart


def main() -> None:
    chart = build_chart()

    # Persist the embedded HTML (Altair's Chart.save API).
    chart.save(str(HTML_PATH))

    # Persist the underlying Vega-Lite spec for inspection.
    spec = chart.to_dict()
    SPEC_PATH.write_text(json.dumps(spec, indent=2), encoding="utf-8")

    print(f"Wrote {HTML_PATH}")
    print(f"Wrote {SPEC_PATH}")


if __name__ == "__main__":
    main()