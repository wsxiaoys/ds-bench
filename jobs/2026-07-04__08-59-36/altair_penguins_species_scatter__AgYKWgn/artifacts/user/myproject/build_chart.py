"""Build a Palmer Penguins scatter plot with Vega-Altair.

This script:
1. Registers the "penguins" dataset in ``vega_datasets`` (the version of
   ``vega_datasets`` installed in this environment is 0.9.0 and does not
   ship the penguins dataset, so we register it manually so that
   ``vega_datasets.data.penguins.url`` is available).
2. Builds a single ``mark_point()`` chart encoding flipper length vs body
   mass, with species mapped to color and sex mapped to shape.
3. Saves the chart to ``/home/user/myproject/chart.html``.
"""

import altair as alt
from vega_datasets import core as _vd_core
from vega_datasets import data


# ---------------------------------------------------------------------------
# Register the "penguins" dataset in vega_datasets.data
# ---------------------------------------------------------------------------
# The installed vega_datasets 0.9.0 release does not include the penguins
# dataset. We register a small subclass with the well-known vega-datasets
# CDN URL for penguins.json (which exists in vega-datasets >= 2.0.0).
class _Penguins(_vd_core.Dataset):
    name = "penguins"
    # The 0.9.0 base_url points at vega-datasets v1.29.0, which predates the
    # addition of the penguins dataset.  We point this subclass at the
    # jsDelivr "latest" URL where the penguins.json file is available.
    base_url = "https://cdn.jsdelivr.net/npm/vega-datasets@latest/data/"

    def __init__(self):
        info = {
            "filename": "penguins.json",
            "format": "json",
            "is_local": False,
        }
        self.name = "penguins"
        self.methodname = "penguins"
        self.filename = info["filename"]
        self.url = self.base_url + info["filename"]
        self.format = info["format"]
        self.pkg_filename = "_data/" + self.filename
        self.is_local = info["is_local"]
        self.description = None
        self.references = None


# Make the DataLoader aware of the new dataset.
_vd_core.Dataset._dataset_info.setdefault(
    "penguins",
    {"filename": "penguins.json", "format": "json", "is_local": False},
)
_vd_core.DataLoader._datasets.setdefault("penguins", "penguins")
data.__dict__.setdefault("penguins", _Penguins())


# ---------------------------------------------------------------------------
# Build the chart
# ---------------------------------------------------------------------------
chart = (
    alt.Chart(data.penguins.url)
    .mark_point(filled=True, size=80)
    .encode(
        x=alt.X("Flipper Length (mm):Q").scale(zero=False),
        y=alt.Y("Body Mass (g):Q").scale(zero=False),
        color=alt.Color("Species:N"),
        shape=alt.Shape("Sex:N"),
        tooltip=[
            alt.Tooltip("Species:N"),
            alt.Tooltip("Island:N"),
            alt.Tooltip("Flipper Length (mm):Q"),
            alt.Tooltip("Body Mass (g):Q"),
        ],
    )
    .interactive()
)

chart.save("/home/user/myproject/chart.html")
