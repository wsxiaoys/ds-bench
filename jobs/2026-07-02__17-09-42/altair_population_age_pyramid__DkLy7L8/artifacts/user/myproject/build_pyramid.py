"""Build a back-to-back US population age pyramid using Vega-Altair.

The script reads the canonical population dataset URL via
``vega_datasets.data.population.url`` and emits a single Altair chart that
renders a classic back-to-back age pyramid:

* Males extend to the left as negative bars.
* Females extend to the right as positive bars.
* The y-axis lists ``age`` buckets with the oldest age at the top.
* The x-axis shows absolute-value labels (e.g. ``10M`` instead of ``-10M``).
* A ``binding_select`` dropdown, bound to a single ``alt.param``, lets the
  viewer pick a census year (initial selection: ``1980``).

Outputs:
* ``/home/user/myproject/pyramid.html``  -- rendered chart via ``Chart.save``.
* ``/home/user/myproject/pyramid_spec.json`` -- raw Vega-Lite spec from
  ``Chart.to_dict()`` for downstream verification.
"""

from __future__ import annotations

import json
from pathlib import Path

import altair as alt
from vega_datasets import data


# Output directory shared by the verifier.
OUTPUT_DIR = Path("/home/user/myproject")

# Distinct census years present in the population dataset. The data is loaded
# lazily from a URL, so the list is supplied explicitly (the dataset covers
# every decade from 1850 through 2000).
YEAR_OPTIONS: list[int] = [
    1850, 1860, 1870, 1880, 1890,
    1900, 1910, 1920, 1930, 1940,
    1950, 1960, 1970, 1980, 1990, 2000,
]

# Sex code -> label mapping used by the legend ``labelExpr``.
SEX_LABEL_EXPR = "datum.value === 1 ? 'Male' : datum.value === 2 ? 'Female' : ''"


def build_chart() -> alt.Chart:
    """Construct the interactive back-to-back age pyramid chart."""

    # Canonical URL string for the population dataset (NOT a pre-loaded frame).
    population_url: str = data.population.url

    # A single ``alt.param`` controls the selected census year. It is bound to
    # a dropdown widget whose options are the distinct years in the dataset.
    year_param = alt.param(
        name="year",
        value=1980,
        bind=alt.binding_select(
            options=YEAR_OPTIONS,
            name="Census year: ",
        ),
    )

    # The signed people value is computed inside the Vega-Lite spec via
    # ``transform_calculate`` -- males (sex == 1) get negated, females keep
    # their positive count.
    chart = (
        alt.Chart(population_url)
        .transform_calculate(
            signed="datum.sex === 1 ? -datum.people : datum.people",
        )
        # Filter the data to the currently selected year. The bare ``year``
        # identifier resolves to the ``year`` parameter above.
        .transform_filter("datum.year === year")
        .mark_bar()
        .encode(
            # Ordinal y-axis with the oldest age bucket at the top.
            y=alt.Y("age:O")
                .title("Age")
                .sort("descending"),
            # Quantitative x-axis. The axis labels are formatted as SI units
            # ("s") and rendered as absolute values via ``labelExpr`` so the
            # negative (male) side reads as a positive count.
            x=alt.X("signed:Q")
                .title("Population")
                .axis(format="s", labelExpr="abs(datum.value)"),
            # Color encodes sex with a custom steelblue / salmon scale. The
            # legend ``labelExpr`` substitutes "Male" / "Female" for the raw
            # integer codes.
            color=alt.Color("sex:N")
                .title("Sex")
                .scale(domain=[1, 2], range=["steelblue", "salmon"])
                .legend(labelExpr=SEX_LABEL_EXPR),
        )
        .add_params(year_param)
        .properties(
            title="US Population Age Pyramid",
            width=420,
            height=320,
        )
    )
    return chart


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    chart = build_chart()

    html_path = OUTPUT_DIR / "pyramid.html"
    spec_path = OUTPUT_DIR / "pyramid_spec.json"

    # ``Chart.save`` produces a self-contained HTML page; Altair embeds the
    # data URL into the spec, so no network access is required at render time.
    chart.save(str(html_path))

    # Persist the raw Vega-Lite spec for the verifier.
    with spec_path.open("w", encoding="utf-8") as fp:
        json.dump(chart.to_dict(), fp, indent=2)

    print(f"Saved chart to {html_path}")
    print(f"Saved spec  to {spec_path}")


if __name__ == "__main__":
    main()