import altair as alt
from vega_datasets import data

def build_dashboard():
    # Load data URL
    source = data.movies.url

    # Define the 2D brush selection
    brush = alt.selection_interval(name='brush')

    # Common ratings filter to ensure no missing values for IMDB_Rating or Rotten_Tomatoes_Rating reach any view
    ratings_filter = (alt.datum.IMDB_Rating != None) & (alt.datum.Rotten_Tomatoes_Rating != None)

    # View A: Scatter plot (brush host)
    scatter = alt.Chart(source).mark_point(filled=True, size=60).encode(
        x=alt.X('IMDB_Rating:Q', title='IMDb Rating'),
        y=alt.Y('Rotten_Tomatoes_Rating:Q', title='Rotten Tomatoes Rating'),
        color=alt.when(brush).then('Major_Genre:N').otherwise(alt.value('lightgray'))
    ).properties(
        width=600,
        height=350,
        title='IMDb vs. Rotten Tomatoes Movie Ratings'
    ).add_params(
        brush
    ).transform_filter(
        ratings_filter
    )

    # View B: Genre bar chart (filtered through the brush, top 8 genres)
    # We also filter out null Major_Genre values so they don't show up in the top 8.
    bar = alt.Chart(source).mark_bar().encode(
        x=alt.X('count:Q', title='Count'),
        y=alt.Y('Major_Genre:N', sort='-x', title='Major Genre')
    ).properties(
        width=260,
        height=250,
        title='Top 8 Genres'
    ).transform_filter(
        ratings_filter & (alt.datum.Major_Genre != None)
    ).transform_filter(
        brush
    ).transform_aggregate(
        count='count()',
        groupby=['Major_Genre']
    ).transform_window(
        rank='rank()',
        sort=[alt.SortField('count', order='descending')]
    ).transform_filter(
        alt.datum.rank <= 8
    )

    # View C: Rating histogram (filtered through the brush)
    hist = alt.Chart(source).mark_bar().encode(
        x=alt.X('IMDB_Rating:Q', bin=alt.Bin(maxbins=20), title='IMDb Rating'),
        y=alt.Y('count():Q', title='Count')
    ).properties(
        width=260,
        height=250,
        title='IMDb Rating Distribution'
    ).transform_filter(
        ratings_filter
    ).transform_filter(
        brush
    )

    # Compose the dashboard layout: View A on top, View B and View C side-by-side below
    dashboard = scatter & (bar | hist)

    # Save the dashboard as a self-contained HTML file
    output_path = '/home/user/myproject/chart.html'
    dashboard.save(output_path)
    print(f"Successfully saved interactive dashboard to {output_path}")

if __name__ == '__main__':
    build_dashboard()
