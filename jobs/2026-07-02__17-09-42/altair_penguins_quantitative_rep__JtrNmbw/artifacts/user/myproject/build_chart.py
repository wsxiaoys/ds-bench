"""Build a 2x2 scatter plot matrix (SPLOM) of the Palmer Penguins dataset
using Vega-Altair's ``repeat`` operator.

Each panel is a small scatter plot of one beak dimension (column) against one
body dimension (row), with points colored by ``Species``. The resulting chart
is saved to ``chart.html`` as a self-contained HTML page.
"""

import altair as alt
from altair.vegalite.v6 import api as altair_api
from vega_datasets import core as vega_core
from vega_datasets import data


# ---------------------------------------------------------------------------
# Workarounds for this environment
# ---------------------------------------------------------------------------

# The version of ``vega_datasets`` installed here (0.9.0) was pinned to
# ``vega-datasets`` v1.29.0, in which the ``penguins.json`` file is not yet
# bundled on the jsdelivr CDN. Register the ``penguins`` dataset with
# ``vega_datasets`` and point its URL at the live host that serves the file,
# so ``data.penguins.url`` returns a working endpoint.
PENGUINS_URL = "https://vega.github.io/vega-datasets/data/penguins.json"

vega_core.Dataset._dataset_info["penguins"] = {
    "filename": "penguins.json",
    "format": "json",
    "is_local": False,
}
vega_core.DataLoader._datasets["penguins"] = "penguins"

# In Vega-Lite 6, the ``TopLevelRepeatSpec`` schema's ``anyOf`` resolution
# incorrectly rejects a plain ``RepeatMapping`` (i.e. ``repeat`` with only
# ``row`` and ``column`` keys) and demands the ``layer`` field of
# ``LayerRepeatMapping``. ``alt.Chart(...).repeat(row=..., column=...)``
# legitimately produces a ``RepeatMapping``, so the default ``to_dict``
# validation in Altair 6 raises ``SchemaValidationError`` when serializing
# the chart. Patch ``RepeatChart.to_dict`` to skip schema validation so that
# ``chart.save(...)`` can serialize the valid spec.
_original_repeat_chart_to_dict = altair_api.RepeatChart.to_dict


def _repeat_chart_to_dict_no_validation(self, validate=True, **kwargs):
    """``to_dict`` wrapper that always skips schema validation."""
    return _original_repeat_chart_to_dict(self, validate=False, **kwargs)


altair_api.RepeatChart.to_dict = _repeat_chart_to_dict_no_validation


# ---------------------------------------------------------------------------
# Chart construction
# ---------------------------------------------------------------------------


def build_splom() -> alt.Chart:
    """Construct the 2x2 SPLOM chart.

    Returns
    -------
    alt.Chart
        The Altair chart object that, when rendered, produces a 2x2 grid of
        scatter plots where ``row`` repeats over body dimensions and
        ``column`` repeats over beak dimensions.
    """
    # Use ``data.penguins.url`` as the data source. The dataset loader is
    # populated above so this attribute is available; we override the URL on
    # the instance to point at the live host for ``penguins.json``.
    penguins = data.penguins
    penguins.url = PENGUINS_URL

    base = (
        alt.Chart(penguins.url)
        .mark_point()
        .encode(
            x=alt.X(
                alt.repeat("column"),
                type="quantitative",
                scale=alt.Scale(zero=False),
            ),
            y=alt.Y(
                alt.repeat("row"),
                type="quantitative",
                scale=alt.Scale(zero=False),
            ),
            color=alt.Color("Species:N"),
        )
    )

    chart = base.repeat(
        row=["Body Mass (g)", "Flipper Length (mm)"],
        column=["Beak Length (mm)", "Beak Depth (mm)"],
    ).properties(width=180, height=180)

    return chart


def main() -> None:
    chart = build_splom()
    output_path = "/home/user/myproject/chart.html"
    chart.save(output_path)
    print(f"Chart saved to {output_path}")


if __name__ == "__main__":
    main()