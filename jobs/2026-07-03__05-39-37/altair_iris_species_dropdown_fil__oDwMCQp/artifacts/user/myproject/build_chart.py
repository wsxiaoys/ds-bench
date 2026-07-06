"""Build an interactive iris scatter plot with a species-highlight dropdown.

Run with:  python3 build_chart.py
Produces:  chart.html  (a self-contained HTML file)
"""

import altair as alt
from vega_datasets import data


def build_chart() -> alt.Chart:
    # URL-based data source (requires explicit type shorthands in encodings).
    iris_url = data.iris.url

    # --- Dropdown widget -------------------------------------------------
    dropdown = alt.binding_select(
        options=['setosa', 'versicolor', 'virginica'],
        name='Species: ',
    )

    # --- Bound parameter -------------------------------------------------
    # Exposes the dropdown's current value as a Vega expression that can be
    # referenced by the parameter's `name` (here ``species_selector``).
    species_param = alt.param(
        bind=dropdown,
        name='species_selector',
        value='setosa',  # sensible default so the chart renders correctly
    )

    # --- Conditional color encoding -------------------------------------
    # When the row's species matches the dropdown selection, keep the normal
    # nominal species color; otherwise de-emphasize with lightgray.
    highlight_color = alt.when(
        "datum.species == species_selector"
    ).then(
        alt.Color('species:N')
    ).otherwise(
        alt.value('lightgray')
    )

    # --- Scatter plot ----------------------------------------------------
    chart = alt.Chart(iris_url).mark_circle().encode(
        x=alt.X('sepalLength:Q'),
        y=alt.Y('sepalWidth:Q'),
        color=highlight_color,
        tooltip=['species:N', 'sepalLength:Q', 'sepalWidth:Q'],
    ).add_params(
        species_param
    ).properties(
        width=500,
        height=400,
        title='Iris species highlight',
    )

    return chart


def main() -> None:
    chart = build_chart()
    out_path = '/home/user/myproject/chart.html'
    chart.save(out_path, format='html')
    print(f'Saved self-contained chart to {out_path}')


if __name__ == '__main__':
    main()