#!/usr/bin/env python3
"""
build_chart.py

Builds a self-contained, offline "Gapminder"-style bubble scatter plot with an
interactive year slider using Vega-Altair (Altair 5+/6+).

The dataset is generated entirely in code (no network access, no vega_datasets),
embedded inline, and the resulting HTML is written to gapminder.html.

Run:
    python3 build_chart.py
"""

import os
import re

import pandas as pd
import altair as alt

# Directory that holds the locally bundled Vega JS libraries so the final
# HTML needs no network access at render time.
VENDOR_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor")

# Map of CDN script URLs -> local vendor filenames to inline.
VENDOR_LIBS = {
    "https://cdn.jsdelivr.net/npm/vega@6": "vega.js",
    "https://cdn.jsdelivr.net/npm/vega-lite@6.4.1": "vega-lite.js",
    "https://cdn.jsdelivr.net/npm/vega-embed@7": "vega-embed.js",
}


def inline_vendor_scripts(html_text):
    """Replace CDN <script src="..."> tags with inline <script> blocks
    containing the locally bundled library source, making the file fully
    self-contained / offline."""
    for url, fname in VENDOR_LIBS.items():
        path = os.path.join(VENDOR_DIR, fname)
        with open(path, "r", encoding="utf-8") as fh:
            js = fh.read()
        src_tag = '<script type="text/javascript" src="{url}"></script>'.format(
            url=url)
        inline_tag = '<script type="text/javascript">\n{js}\n</script>'.format(
            js=js)
        if src_tag in html_text:
            html_text = html_text.replace(src_tag, inline_tag)
        else:
            # fall back to a regex match in case of attribute reordering
            pattern = re.compile(
                r'<script[^>]*src="%s"[^>]*></script>' % re.escape(url))
            html_text = pattern.sub(inline_tag, html_text)
    return html_text

# ---------------------------------------------------------------------------
# 1. Build a tidy, local Gapminder-like dataset.
#
#    One row per country-per-year. Columns (exact names required):
#       year            (int)    - the year of the observation
#       country         (str)    - country name
#       region          (str)    - broad geographic region
#       gdp_per_capita  (float)  - GDP per capita (USD), used on a log x-axis
#       life_expectancy (float)  - life expectancy in years, used on the y-axis
#       population      (int)    - population, encoded as bubble size
#
#    Constraints satisfied:
#       * >= 5 distinct years   -> we use 6 decades (1960..2010, step 10)
#       * >= 4 distinct regions -> Africa, Asia, Europe, Americas
#       * several countries per region (7 each -> 28 countries, 168 rows)
#       * well under Altair's default max-rows limit (5000) so data embeds inline
# ---------------------------------------------------------------------------

# Years present in the dataset (the slider will span exactly these years).
YEARS = [1960, 1970, 1980, 1990, 2000, 2010]

# Each entry: country -> (region, gdp_1960, gdp_2010, life_1960, life_2010, pop_1960_M, pop_2010_M)
# Values are rough, Gapminder-inspired estimates. Population is in millions.
COUNTRIES = [
    # ---- Africa ----
    ("Nigeria",      "Africa",  1200,  2200, 39.0, 51.0,  45, 160),
    ("Ethiopia",     "Africa",   600,  1100, 42.0, 59.0,  22,  83),
    ("Egypt",        "Africa",  1700,  6500, 47.0, 70.0,  26,  81),
    ("South Africa", "Africa",  4000,  7200, 49.0, 52.0,  17,  50),
    ("Kenya",        "Africa",   850,  1600, 45.0, 59.0,   8,  40),
    ("Ghana",        "Africa",  1100,  2400, 44.0, 60.0,   7,  24),
    ("Morocco",      "Africa",  1500,  4200, 46.0, 70.0,  12,  32),
    # ---- Asia ----
    ("China",        "Asia",     650,  8500, 43.0, 73.0, 667, 1341),
    ("India",        "Asia",     820,  3400, 41.0, 65.0, 450, 1240),
    ("Japan",        "Asia",    4800, 34000, 68.0, 83.0,  94, 128),
    ("South Korea",  "Asia",    1100, 28000, 54.0, 81.0,  25,  49),
    ("Indonesia",    "Asia",     800,  3500, 45.0, 69.0,  88, 240),
    ("Vietnam",      "Asia",     700,  2800, 46.0, 74.0,  34,  87),
    ("Pakistan",     "Asia",     750,  2600, 44.0, 65.0,  46, 174),
    # ---- Europe ----
    ("Germany",      "Europe",  6700, 40000, 69.0, 80.0,  72,  82),
    ("France",       "Europe",  7200, 36000, 70.0, 81.0,  46,  65),
    ("United Kingdom","Europe", 8000, 36000, 71.0, 80.0,  52,  62),
    ("Italy",        "Europe",  5800, 31000, 69.0, 82.0,  50,  60),
    ("Spain",        "Europe",  3900, 29000, 68.0, 81.0,  30,  46),
    ("Poland",       "Europe",  2500, 18000, 67.0, 76.0,  30,  38),
    ("Sweden",       "Europe",  8600, 45000, 73.0, 81.0,   7,   9),
    # ---- Americas ----
    ("United States","Americas",9000, 46000, 70.0, 78.0, 181, 309),
    ("Brazil",       "Americas",2100, 11000, 54.0, 73.0,  70, 195),
    ("Mexico",       "Americas",2300,  9700, 57.0, 76.0,  35, 114),
    ("Canada",       "Americas",7400, 42000, 71.0, 81.0,  18,  34),
    ("Argentina",    "Americas",3700, 13000, 65.0, 75.0,  21,  40),
    ("Colombia",     "Americas",1500,  6400, 56.0, 73.0,  16,  46),
    ("Chile",        "Americas",2500, 13000, 57.0, 78.0,  10,  17),
]


def build_dataframe():
    """Construct the tidy DataFrame by linearly interpolating each country's
    metrics across the six decade years."""
    rows = []
    nsteps = len(YEARS) - 1  # number of intervals between years

    for (country, region, gdp0, gdp1, life0, life1, pop0, pop1) in COUNTRIES:
        for i, year in enumerate(YEARS):
            frac = i / nsteps  # 0 at first year -> 1 at last year
            gdp = gdp0 + (gdp1 - gdp0) * frac
            life = life0 + (life1 - life0) * frac
            pop_m = pop0 + (pop1 - pop0) * frac
            rows.append({
                "year": int(year),
                "country": country,
                "region": region,
                "gdp_per_capita": round(gdp, 1),
                "life_expectancy": round(life, 1),
                # store population as an integer count of people
                "population": int(round(pop_m * 1_000_000)),
            })

    df = pd.DataFrame(
        rows,
        columns=["year", "country", "region", "gdp_per_capita",
                 "life_expectancy", "population"],
    )
    # enforce dtypes for clean Altair inference
    df["year"] = df["year"].astype(int)
    df["country"] = df["country"].astype(str)
    df["region"] = df["region"].astype(str)
    df["gdp_per_capita"] = df["gdp_per_capita"].astype(float)
    df["life_expectancy"] = df["life_expectancy"].astype(float)
    df["population"] = df["population"].astype(int)
    return df


# ---------------------------------------------------------------------------
# 2. Build the chart.
# ---------------------------------------------------------------------------

def build_chart(df):
    # Year slider: a range input bound to a variable parameter.
    # min/max/step span the years present so every year is reachable.
    year_param = alt.param(
        name="year",
        bind=alt.binding_range(
            min=min(YEARS),
            max=max(YEARS),
            step=YEARS[1] - YEARS[0],  # 10
            name="Year:",
        ),
        value=min(YEARS),  # initial selection
    )

    chart = alt.Chart(df).mark_circle(
        opacity=0.7,
        stroke="white",
        strokeWidth=0.5,
    ).encode(
        x=alt.X(
            "gdp_per_capita:Q",
            scale=alt.Scale(type="log", domain=[500, 60000]),
            axis=alt.Axis(
                title="GDP per capita (log scale)",
                labelExpr="'$' + format(datum.value, '~s')",
            ),
        ),
        y=alt.Y(
            "life_expectancy:Q",
            scale=alt.Scale(domain=[30, 90]),
            axis=alt.Axis(title="Life expectancy (years)"),
        ),
        size=alt.Size(
            "population:Q",
            scale=alt.Scale(range=[80, 2500]),
            legend=alt.Legend(title="Population"),
        ),
        color=alt.Color(
            "region:N",
            legend=alt.Legend(title="Region"),
            scale=alt.Scale(scheme="category10"),
        ),
        tooltip=[
            alt.Tooltip("country:N", title="Country"),
            alt.Tooltip("year:Q", title="Year"),
            alt.Tooltip("region:N", title="Region"),
            alt.Tooltip("gdp_per_capita:Q", title="GDP per capita ($)",
                        format="$,.0f"),
            alt.Tooltip("life_expectancy:Q", title="Life expectancy",
                        format=".1f"),
            alt.Tooltip("population:Q", title="Population",
                        format="~s"),
        ],
    ).add_params(
        year_param
    ).transform_filter(
        # Only show marks for the year selected by the slider.
        alt.datum.year == year_param
    ).properties(
        width=760,
        height=480,
        title="Gapminder: Wealth & Health of Nations",
    ).configure_view(
        continuousHeight=480,
        continuousWidth=760,
    )

    return chart


# ---------------------------------------------------------------------------
# 3. Save as a single, offline HTML file.
# ---------------------------------------------------------------------------

def main():
    df = build_dataframe()

    # quick sanity checks on the data
    assert set(df.columns) == {
        "year", "country", "region", "gdp_per_capita",
        "life_expectancy", "population",
    }, "Column names do not match the required schema"
    assert df["year"].nunique() >= 5, "Need at least 5 distinct years"
    assert df["region"].nunique() >= 4, "Need at least 4 distinct regions"
    assert df.groupby("region")["country"].nunique().min() >= 2, \
        "Need several countries per region"
    print(f"Dataset: {len(df)} rows, "
          f"{df['year'].nunique()} years, "
          f"{df['region'].nunique()} regions, "
          f"{df['country'].nunique()} countries")

    chart = build_chart(df)

    out_path = "/home/user/project/gapminder.html"
    # chart.save embeds the data inline (embed=True by default for HTML) but
    # references the Vega JS libraries from a CDN. We then inline those local
    # vendor copies so the file renders with no network access at all.
    chart.save(out_path, format="html", embed_options={"renderer": "svg"})

    with open(out_path, "r", encoding="utf-8") as fh:
        html_text = fh.read()
    html_text = inline_vendor_scripts(html_text)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(html_text)

    print(f"Saved offline chart to {out_path}")


if __name__ == "__main__":
    main()