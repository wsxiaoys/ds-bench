import altair as alt
from vega_datasets import data
from vega_datasets.core import Dataset, DataLoader

# The ``penguins`` dataset was removed from vega-datasets v1.29.0 (which this
# version of vega_datasets pulls from). To make the idiomatic
# ``data.penguins.url`` accessor work, register a custom Dataset subclass that
# points at the v2 release of vega-datasets, where it is still hosted.
PENGUINS_URL = "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/penguins.json"


class Penguins(Dataset):
    """Custom dataset loader for the Palmer Penguins JSON file."""

    name = "penguins"
    filename = "penguins.json"
    format = "json"
    base_url = "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/"


# Register the custom loader so that ``data.penguins`` resolves to it.
Dataset._dataset_info.setdefault(
    "penguins",
    {"filename": "penguins.json", "format": "json", "is_local": False},
)
DataLoader._datasets.setdefault("penguins", "penguins")

# Replace the REDACTED-discovered loader for ``penguins`` with our custom subclass.
data.penguins = Penguins("penguins")

# Build the scatter plot using the Palmer Penguins dataset URL.
# Because the data is loaded from a URL, types must be declared explicitly
# using the Altair shorthand (e.g. :Q, :N).
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

# Save the chart as a single self-contained HTML file.
chart.save("/home/user/myproject/chart.html")
print("Saved chart to /home/user/myproject/chart.html")
