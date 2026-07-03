"""Build an interactive Vega-Altair scatter plot of the iris dataset.

The chart uses a bound dropdown widget to highlight one species at a time.
Non-matching points are colored `lightgray`, while points belonging to the
selected species keep their normal species color.
"""

import altair as alt
from vega_datasets import data


# Define a single bound input parameter whose value drives the highlight.
# The default value of 'setosa' ensures the chart renders correctly even
# before the user interacts with the dropdown widget.
species_param = alt.param(
    name="species",
    value="setosa",
    bind=alt.binding_select(
        options=["setosa", "versicolor", "virginica"],
        name="Species: ",
    ),
)


# Build the scatter plot using a URL-based data source, which requires
# explicit encoding type shorthands.
chart = (
    alt.Chart(data.iris.url)
    .mark_point()
    .encode(
        x="sepalLength:Q",
        y="sepalWidth:Q",
        color=alt.when("datum.species == species")
        .then(alt.Color("species:N"))
        .otherwise(alt.value("lightgray")),
    )
    .add_params(species_param)
)


# Save the resulting chart as a single self-contained HTML file.
chart.save("/home/user/myproject/chart.html")