"""Three-view crossfilter dashboard for the IMDb/Rotten Tomatoes movies dataset.

Produces a self-contained HTML file (`chart.html`) that contains an
interactive Vega-Lite dashboard: a 2D brushable scatter plot drives a
bar chart of the top genres and a histogram of IMDB ratings.
"""

import altair as alt
from vega_datasets import data


# ---------------------------------------------------------------------------
# Shared configuration
# ---------------------------------------------------------------------------
# URL-based data source for the movies dataset with explicit type shorthands.
# Explicit types are required when loading from a URL because Altair cannot
# otherwise infer the column schema.
movies_url = alt.UrlData(
    data.movies.url,
    format=alt.DataFormat(type="json"),
)
type_overrides = {
    "IMDB_Rating": "quantitative",
    "Rotten_Tomatoes_Rating": "quantitative",
    "Major_Genre": "nominal",
    "Title": "nominal",
}

# 2D interval selection acts as the cross-filter brush for all three views.
brush = alt.selection_interval(name="brush", encodings=["x", "y"])

# A pre-filter that drops rows missing either of the two ratings used in the
# scatter. Apply this on every view so no missing data leaks into the charts.
NO_NULL_RATINGS = (
    "isValid(datum.IMDB_Rating) && isValid(datum.Rotten_Tomatoes_Rating)"
)


# ---------------------------------------------------------------------------
# View A — scatter plot (brush host)
# ---------------------------------------------------------------------------
scatter = (
    alt.Chart(
        movies_url,
        title="IMDB vs. Rotten Tomatoes Ratings (brush to filter)",
    )
    .mark_point(filled=True, size=60, opacity=0.7)
    .encode(
        x=alt.X("IMDB_Rating:Q", title="IMDB Rating"),
        y=alt.Y("Rotten_Tomatoes_Rating:Q", title="Rotten Tomatoes Rating"),
        color=alt.condition(
            brush,
            alt.Color(
                "Major_Genre:N",
                title="Major Genre",
                scale=alt.Scale(scheme="tableau20"),
            ),
            alt.value("lightgray"),
        ),
        tooltip=[
            "Title:N",
            "Major_Genre:N",
            "IMDB_Rating:Q",
            "Rotten_Tomatoes_Rating:Q",
        ],
    )
    .transform_filter(NO_NULL_RATINGS)
    .add_params(brush)
    .properties(width=700, height=400)
)


# ---------------------------------------------------------------------------
# View B — bar chart of the top 8 Major_Genre values (filtered by brush)
# ---------------------------------------------------------------------------
# Restrict the bar chart to the top 8 most frequent Major_Genre values so the
# view stays compact. The brush filter is applied first; the top-8 ranking is
# then computed over the brushed subset via transform_aggregate + transform_window.
genre_bar = (
    alt.Chart(
        movies_url,
        title="Top Genres (filtered by brush)",
    )
    .mark_bar()
    .encode(
        x=alt.X("count():Q", title="Number of Movies"),
        y=alt.Y(
            "Major_Genre:N",
            sort="-x",
            title="Major Genre",
        ),
        color=alt.Color("Major_Genre:N", legend=None, scale=alt.Scale(scheme="tableau20")),
        tooltip=["Major_Genre:N", "count():Q"],
    )
    .transform_filter(NO_NULL_RATINGS)
    .transform_filter(brush)
    .transform_aggregate(count="count()", groupby=["Major_Genre"])
    .transform_window(rank="rank(count)", sort=[alt.SortField("count", order="descending")])
    .transform_filter("datum.rank <= 8")
    .properties(width=340, height=300)
)


# ---------------------------------------------------------------------------
# View C — IMDB rating histogram (filtered by brush)
# ---------------------------------------------------------------------------
imdb_hist = (
    alt.Chart(
        movies_url,
        title="IMDB Rating Distribution (filtered by brush)",
    )
    .mark_bar()
    .encode(
        x=alt.X(
            "IMDB_Rating:Q",
            bin=alt.Bin(maxbins=20),
            title="IMDB Rating (binned, 20 bins)",
        ),
        y=alt.Y("count():Q", title="Number of Movies"),
        tooltip=[
            alt.Tooltip("IMDB_Rating:Q", bin=alt.Bin(maxbins=20), title="IMDB bin"),
            "count():Q",
        ],
    )
    .transform_filter(NO_NULL_RATINGS)
    .transform_filter(brush)
    .properties(width=340, height=300)
)


# ---------------------------------------------------------------------------
# Compose the dashboard: scatter on top, bar + histogram underneath.
# ---------------------------------------------------------------------------
dashboard = alt.vconcat(
    scatter,
    alt.hconcat(genre_bar, imdb_hist),
    title="Movies Crossfilter Dashboard",
).resolve_scale(color="independent").resolve_legend(color="independent")


if __name__ == "__main__":
    output_path = "/home/user/myproject/chart.html"
    dashboard.save(output_path)
    print(f"Saved dashboard to {output_path}")
