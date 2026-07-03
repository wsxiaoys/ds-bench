import altair as alt
from vega_datasets import data

def main():
    # Load the Iris dataset URL
    source = data.iris.url

    # Define a single bound input parameter using alt.binding_select
    dropdown = alt.binding_select(
        options=['setosa', 'versicolor', 'virginica'],
        name='Species: '
    )

    # Bind that input to a parameter created with alt.param(...)
    species_param = alt.param(
        name='selected_species',
        value='setosa',
        bind=dropdown
    )

    # Build a scatter plot with sepalLength on the x axis and sepalWidth on the y axis,
    # encoded as quantitative. Use a point/circle mark.
    # Use alt.when(...).then(...).otherwise(...) to drive the color encoding.
    chart = (
        alt.Chart(source)
        .mark_point()
        .encode(
            x='sepalLength:Q',
            y='sepalWidth:Q',
            color=alt.when(f"datum.species == {species_param.name}")
            .then(alt.Color('species:N'))
            .otherwise(alt.value('lightgray'))
        )
        .add_params(species_param)
    )

    # Save the resulting chart as a single self-contained HTML file named chart.html
    chart.save('/home/user/myproject/chart.html')
    print("Chart successfully generated and saved to /home/user/myproject/chart.html")

if __name__ == '__main__':
    main()
