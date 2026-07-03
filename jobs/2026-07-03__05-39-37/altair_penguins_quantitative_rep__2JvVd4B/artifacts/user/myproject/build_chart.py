"""Build a 2x2 SPLOM of the Palmer Penguins dataset with Vega-Altair's repeat.

Run with::

    python3 build_chart.py

The resulting chart is written to /home/user/myproject/chart.html as a
self-contained HTML page that loads Vega-Lite / vega-embed from a CDN.
"""

import altair as alt
import vega_datasets.core as _core
from vega_datasets import data

# ---------------------------------------------------------------------------
# Register the Palmer Penguins dataset with vega_datasets.
#
# The ``vega_datasets`` Python package (0.9.0, the latest release) ships an
# index of datasets pinned to the vega-datasets@v1.29.0 npm bundle, which does
# not include ``penguins``.  The canonical ``penguins.json`` file *does* live in
# the upstream vega-datasets GitHub repository and is reachable at the raw
# GitHub URL below.  To keep using the documented ``data.penguins.url`` access
# pattern, we register the dataset at runtime and point the loader at the
# GitHub raw URL (where ``penguins.json`` is actually available).
# ---------------------------------------------------------------------------
PENGUINS_RAW_BASE = "https://raw.githubusercontent.com/vega/vega-datasets/main/data/"
_core.Dataset.base_url = PENGUINS_RAW_BASE
_core.Dataset._dataset_info.setdefault(
    "penguins",
    {"filename": "penguins.json", "format": "json", "is_local": False},
)
# Make ``data.penguins`` resolvable through both the local and remote loaders.
_core.DataLoader._datasets.setdefault("penguins", "penguins")
_core.LocalDataLoader._datasets.setdefault("penguins", "penguins")

# ---------------------------------------------------------------------------
# Build the SPLOM via the ``repeat`` operator.
# ---------------------------------------------------------------------------
source = data.penguins.url  # URL-based data source; types declared below.

base = (
    alt.Chart(source)
    .mark_point()
    .encode(
        # alt.repeat('column'/'row') are substituted per-panel; because the
        # data is a URL (not a pandas DataFrame) the field type must be
        # declared explicitly as quantitative.
        x=alt.X(alt.repeat("column"), type="quantitative", scale=alt.Scale(zero=False)),
        y=alt.Y(alt.repeat("row"), type="quantitative", scale=alt.Scale(zero=False)),
        color=alt.Color("Species:N"),  # shared legend across all panels
    )
    .properties(width=180, height=180)
)

chart = base.repeat(
    row=["Body Mass (g)", "Flipper Length (mm)"],
    column=["Beak Length (mm)", "Beak Depth (mm)"],
)

chart.save("/home/user/myproject/chart.html")
print("Saved /home/user/myproject/chart.html")
print("Data source URL:", source)