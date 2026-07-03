import altair as alt
from vega_datasets import data

def main():
    # Load US state geometries from the us-10m.json TopoJSON file
    states = alt.topo_feature(data.us_10m.url, 'states')

    # Data source URL for lookup (population, engineers, hurricanes)
    data_url = data.population_engineers_hurricanes.url

    # Build the choropleth map chart
    chart = alt.Chart(states).mark_geoshape().encode(
        color=alt.Color('engineers:Q', scale=alt.Scale(scheme='blues')),
        tooltip=['state:N', 'engineers:Q']
    ).transform_lookup(
        lookup='id',
        from_=alt.LookupData(data_url, key='id', fields=['state', 'engineers'])
    ).project(
        type='albersUsa'
    ).properties(
        width=700,
        height=400
    )

    # Save the chart as a self-contained HTML file
    chart.save('/home/user/myproject/chart.html')
    print("Chart saved successfully to /home/user/myproject/chart.html")

if __name__ == '__main__':
    main()
