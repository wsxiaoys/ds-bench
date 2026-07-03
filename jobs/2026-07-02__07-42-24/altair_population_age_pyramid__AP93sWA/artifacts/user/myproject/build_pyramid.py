import json
import altair as alt
from vega_datasets import data

def main() -> None:
    # Define the distinct years present in the population dataset (excluding 1890 due to census data loss)
    years = [1850, 1860, 1870, 1880, 1900, 1910, 1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000]
    
    # Dropdown widget for selecting the year
    year_dropdown = alt.binding_select(
        options=years,
        name="Select Year: "
    )
    
    # Selection parameter bound to the dropdown, with initial value of 1980
    year_param = alt.param(
        name="year_param",
        value=1980,
        bind=year_dropdown
    )
    
    # Build the back-to-back pyramid chart using the canonical population dataset URL
    chart = alt.Chart(data.population.url).mark_bar().encode(
        x=alt.X(
            'sum(signed_people):Q',
            title='population',
            axis=alt.Axis(format='s', labelExpr="abs(datum.value)")
        ),
        y=alt.Y(
            'age:O',
            sort='descending'
        ),
        color=alt.Color(
            'sex:N',
            scale=alt.Scale(domain=[1, 2], range=['steelblue', 'salmon']),
            legend=alt.Legend(
                title='Sex',
                labelExpr="datum.value == 1 ? 'Male' : 'Female'"
            )
        )
    ).add_params(
        year_param
    ).transform_calculate(
        signed_people="datum.sex === 1 ? -datum.people : datum.people"
    ).transform_filter(
        alt.datum.year == year_param
    ).properties(
        width=400,
        height=400,
        title="US Population Pyramid"
    )
    
    # Save the chart to HTML using Altair's save API
    chart.save('/home/user/myproject/pyramid.html')
    
    # Write the underlying Vega-Lite spec to pyramid_spec.json
    spec = chart.to_dict()
    with open('/home/user/myproject/pyramid_spec.json', 'w') as f:
        json.dump(spec, f, indent=2)

if __name__ == "__main__":
    main()
