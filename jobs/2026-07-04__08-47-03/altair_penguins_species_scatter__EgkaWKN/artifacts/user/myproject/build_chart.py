"""Build a Palmer Penguins scatter plot with Vega-Altair and export it to HTML.

The chart visualizes flipper length vs body mass, encoding species by color and
sex by shape, with a multi-field tooltip and pan/zoom interactivity.

Run with::

    python3 build_chart.py

This produces ``chart.html`` in the project directory.
"""

import altair as alt
from vega_datasets import data
from vega_datasets.core import Dataset, DataLoader

# ---------------------------------------------------------------------------
# Register the ``penguins`` dataset with vega_datasets.
#
# The installed vega_datasets (0.9.0) bundles datasets from the
# ``vega-datasets@v1.29.0`` tag, which predates the ``penguins.json`` data
# file. The penguins data therefore is not part of the local dataset registry,
# and ``vega_datasets.data.penguins`` would raise ``AttributeError``.
#
# To honor the requirement of using ``vega_datasets.data.penguins.url`` as the
# data source, we register the dataset at runtime so that attribute access
# resolves to a valid remote URL (the data is fetched by the browser when the
# chart renders). Because the data is loaded from a URL rather than an inline
# DataFrame, the Altair field shorthands (``:Q``, ``:N``) must declare types
# explicitly below.
# ---------------------------------------------------------------------------

PENGUINS_URL = (
    "https://cdn.jsdelivr.net/gh/vega/vega-datasets@main/data/penguins.json"
)

# Make the dataset known to the registry so ``Dataset._infodict`` succeeds.
Dataset._dataset_info.setdefault(
    "penguins",
    {"filename": "penguins.json", "format": "json", "is_local": False},
)


class _Penguins(Dataset):
    """Dataset loader for the Palmer Penguins data with a remote URL."""

    name = "penguins"

    def __init__(self, name: str = "penguins") -> None:
        super().__init__(name)
        # Override the (404) bundled CDN URL with the location where the
        # penguins data actually lives.
        self.url = PENGUINS_URL


# Register the loader so ``data.penguins`` returns our ``_Penguins`` instance.
DataLoader._datasets.setdefault("penguins", "penguins")


def build_chart() -> alt.Chart:
    """Return the interactive penguins scatter plot."""
    return (
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


def main() -> None:
    chart = build_chart()
    output_path = "/home/user/myproject/chart.html"
    chart.save(output_path)
    print(f"Chart saved to {output_path}")


if __name__ == "__main__":
    main()