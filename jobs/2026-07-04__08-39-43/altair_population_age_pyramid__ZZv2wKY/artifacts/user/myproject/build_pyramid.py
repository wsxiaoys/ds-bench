import json
import altair as alt

def main() -> None:
    # Use the canonical population URL from altair
    data_url = alt.datasets.data.population.url

    # Define the dropdown parameter for selection of year, initial year is 1980
    year_param = alt.param(
        name="year_selector",
        value=1980,
        bind=alt.binding_select(
            options=[1850, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000],
            name="Select Year: "
        )
    )

    # Build the back-to-back age pyramid chart
    chart = alt.Chart(data_url).mark_bar().transform_calculate(
        signed_people="datum.sex === 1 ? -datum.people : datum.people"
    ).transform_filter(
        alt.datum.year == year_param
    ).encode(
        x=alt.X(
            'signed_people:Q',
            axis=alt.Axis(
                format='s',
                labelExpr='abs(datum.value)',
                title='population'
            )
        ),
        y=alt.Y(
            'age:O',
            sort='descending'
        ),
        color=alt.Color(
            'sex:N',
            scale=alt.Scale(
                domain=[1, 2],
                range=['steelblue', 'salmon']
            ),
            legend=alt.Legend(
                title='Sex',
                labelExpr="datum.value == 1 ? 'Male' : 'Female'"
            )
        )
    ).add_params(
        year_param
    )

    # Save the chart to HTML and write the spec to JSON
    html_path = "/home/user/myproject/pyramid.html"
    json_path = "/home/user/myproject/pyramid_spec.json"

    chart.save(html_path)

    # Write the underlying Vega-Lite spec to pyramid_spec.json
    spec = chart.to_dict()
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(spec, f, indent=2)

    print(f"Successfully generated {html_path} and {json_path}")

if __name__ == "__main__":
    main()
