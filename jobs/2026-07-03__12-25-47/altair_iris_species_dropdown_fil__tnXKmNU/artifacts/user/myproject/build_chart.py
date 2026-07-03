import altair as alt
from vega_datasets import data

# Use the URL-based iris data source
iris_url = data.iris.url

# Define a bound parameter (dropdown widget) for selecting a species.
species_param = alt.param(
    name='species_param',
    value='setosa',
    bind=alt.binding_select(
        options=['setosa', 'versicolor', 'virginica'],
        name='Species: ',
    ),
)

# Build the scatter plot: sepalLength (x) vs sepalWidth (y).
chart = (
    alt.Chart(iris_url)
    .mark_circle()
    .encode(
        x='sepalLength:Q',
        y='sepalWidth:Q',
        color=alt.when(
            f'datum.species == {species_param.name}'
        ).then(alt.Color('species:N')).otherwise(alt.value('lightgray')),
    )
    .add_params(species_param)
)

# Save as a single self-contained HTML file.
chart.save('/home/user/myproject/chart.html')
print('Saved chart to /home/user/myproject/chart.html')
