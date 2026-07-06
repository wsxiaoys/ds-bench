import altair as alt
from vega_datasets import data, core as _vd_core

# Monkey-patch vega_datasets to add the "penguins" dataset entry.
# The base URL of vega_datasets points at jsDelivr; "penguins" is published
# there as penguins.csv, so we register it on the Dataset class metadata
# and then create a DataLoader attribute that exposes it as data.penguins.
_penguins_info = {"filename": "penguins.csv", "format": "csv", "is_local": False}
_vd_core.Dataset._dataset_info["penguins"] = _penguins_info
if "penguins" not in _vd_core.DataLoader._datasets:
    _vd_core.DataLoader._datasets["penguins"] = "penguins"
if "penguins" not in _vd_core.LocalDataLoader._datasets:
    _vd_core.LocalDataLoader._datasets["penguins"] = "penguins"

# Build the Palmer Penguins scatter plot.
# Data is loaded from a URL, so we must declare types explicitly using the Altair shorthand.
chart = (
    alt.Chart(data.penguins.url)
    .mark_point(filled=True, size=80)
    .encode(
        x=alt.X("Flipper Length (mm):Q").scale(zero=False),
        y=alt.Y("Body Mass (g):Q").scale(zero=False),
        color=alt.Color("Species:N"),
        shape=alt.Shape("Sex:N"),
        tooltip=[
            "Species:N",
            "Island:N",
            "Flipper Length (mm):Q",
            "Body Mass (g):Q",
        ],
    )
    .interactive()
)

# Save the chart to a self-contained HTML file.
chart.save("/home/user/myproject/chart.html")
