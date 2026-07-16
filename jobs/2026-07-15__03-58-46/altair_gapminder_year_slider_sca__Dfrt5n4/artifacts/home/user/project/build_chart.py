"""
Gapminder-style animated bubble scatter chart built with Vega-Altair 5+.

Generates synthetic (but realistic) data entirely in-process — no network
access required.  Saves a single self-contained HTML file.
"""

import math
import pandas as pd
import altair as alt

# ---------------------------------------------------------------------------
# 1.  Build a synthetic Gapminder dataset
#     - 4 regions, 10 countries each  →  40 countries
#     - 10 years (1960 – 2010, step 5)  →  400 rows (well under Altair's 5 000-row default)
# ---------------------------------------------------------------------------

YEARS = list(range(1960, 2015, 5))   # 11 years: 1960, 1965, …, 2010

# Seed data: (country, region, gdp_1960, le_1960, pop_1960)
#   gdp = GDP per capita (USD, 1960 base)
#   le  = life expectancy (years)
#   pop = population (millions)
SEEDS = [
    # Sub-Saharan Africa
    ("Nigeria",       "Sub-Saharan Africa",   350,  37, 45.1),
    ("Ethiopia",      "Sub-Saharan Africa",   200,  36, 22.0),
    ("Kenya",         "Sub-Saharan Africa",   290,  44, 8.1),
    ("Tanzania",      "Sub-Saharan Africa",   240,  42, 10.1),
    ("Ghana",         "Sub-Saharan Africa",   470,  46, 6.8),
    ("Mozambique",    "Sub-Saharan Africa",   210,  35, 7.6),
    ("South Africa",  "Sub-Saharan Africa",  1800,  49, 17.4),
    ("Senegal",       "Sub-Saharan Africa",   540,  38, 3.2),
    ("Uganda",        "Sub-Saharan Africa",   290,  43, 6.8),
    ("Zambia",        "Sub-Saharan Africa",   480,  42, 3.1),
    # South Asia / East Asia
    ("India",         "Asia",                 350,  41, 450.5),
    ("China",         "Asia",                 200,  44, 660.3),
    ("Bangladesh",    "Asia",                 210,  39, 50.8),
    ("Pakistan",      "Asia",                 320,  43, 45.9),
    ("Indonesia",     "Asia",                 430,  41, 96.2),
    ("Japan",         "Asia",                3200,  68, 94.1),
    ("South Korea",   "Asia",                 820,  54, 25.0),
    ("Thailand",      "Asia",                 700,  54, 27.4),
    ("Vietnam",       "Asia",                 200,  44, 32.7),
    ("Philippines",   "Asia",                 680,  56, 27.6),
    # Europe & North America
    ("United States", "Americas",           14000,  70, 186.0),
    ("Canada",        "Americas",           10000,  71, 17.9),
    ("United Kingdom","Europe",              9500,  71, 52.4),
    ("Germany",       "Europe",             10500,  70, 72.5),
    ("France",        "Europe",              9800,  70, 45.7),
    ("Sweden",        "Europe",             11000,  73, 7.5),
    ("Spain",         "Europe",              5000,  68, 30.5),
    ("Italy",         "Europe",              6000,  69, 50.2),
    ("Poland",        "Europe",              3500,  66, 29.6),
    ("Netherlands",   "Europe",             10000,  73, 11.5),
    # Latin America & MENA
    ("Brazil",        "Americas",            2500,  55, 72.8),
    ("Mexico",        "Americas",            3200,  57, 38.0),
    ("Argentina",     "Americas",            5000,  65, 20.6),
    ("Colombia",      "Americas",            1900,  57, 16.0),
    ("Peru",          "Americas",            2000,  49, 10.2),
    ("Egypt",         "Middle East & N. Africa", 900,  46, 27.9),
    ("Algeria",       "Middle East & N. Africa", 1100, 47, 10.8),
    ("Morocco",       "Middle East & N. Africa", 850,  47, 11.6),
    ("Turkey",        "Middle East & N. Africa",1700,  52, 27.5),
    ("Saudi Arabia",  "Middle East & N. Africa",3500,  44, 4.1),
]

# Growth rate profiles per region (annual, approximate):
#   gdp_growth: compound annual growth rate (fraction)
#   le_gain:    years of life expectancy gained per 5-year period
#   pop_growth: annual population growth rate

REGION_GROWTH = {
    "Sub-Saharan Africa":      dict(gdp=0.020, le=0.55, pop=0.029),
    "Asia":                    dict(gdp=0.045, le=0.70, pop=0.018),
    "Europe":                  dict(gdp=0.030, le=0.25, pop=0.005),
    "Americas":                dict(gdp=0.028, le=0.45, pop=0.018),
    "Middle East & N. Africa": dict(gdp=0.035, le=0.60, pop=0.025),
}

# Country-level multipliers to add variety (gdp_mult, le_mult, pop_mult)
COUNTRY_MULT = {c[0]: (1.0, 1.0, 1.0) for c in SEEDS}
COUNTRY_MULT.update({
    "Japan":         (1.15, 1.05, 0.85),
    "South Korea":   (1.30, 1.05, 0.90),
    "China":         (1.20, 1.02, 0.95),
    "India":         (0.95, 0.98, 1.05),
    "Nigeria":       (0.90, 0.97, 1.10),
    "South Africa":  (1.05, 0.96, 1.00),
    "United States": (1.05, 1.00, 0.90),
    "Brazil":        (1.10, 1.02, 1.00),
    "Saudi Arabia":  (1.40, 1.05, 1.08),
})

rows = []
for (country, region, gdp0, le0, pop0) in SEEDS:
    g = REGION_GROWTH[region]
    gm, lm, pm = COUNTRY_MULT[country]
    for i, yr in enumerate(YEARS):
        periods = i          # number of 5-year steps from 1960
        years_elapsed = periods * 5
        gdp = gdp0 * ((1 + g["gdp"] * gm) ** years_elapsed)
        le  = min(le0 + g["le"] * lm * years_elapsed, 84.0)
        pop = pop0 * ((1 + g["pop"] * pm) ** years_elapsed)
        rows.append({
            "year":            yr,
            "country":         country,
            "region":          region,
            "gdp_per_capita":  round(gdp, 1),
            "life_expectancy": round(le, 2),
            "population":      round(pop * 1e6),   # store as integer people
        })

df = pd.DataFrame(rows)

print(f"Dataset shape: {df.shape}")
print(f"Years:   {sorted(df['year'].unique())}")
print(f"Regions: {sorted(df['region'].unique())}")
print(f"Countries: {df['country'].nunique()}")
print(df.head())

# ---------------------------------------------------------------------------
# 2.  Build the Altair chart
# ---------------------------------------------------------------------------

year_min  = int(df["year"].min())
year_max  = int(df["year"].max())
year_step = 5                         # matches the 5-year cadence in YEARS

# Bind a range-slider to the 'year' parameter
year_slider = alt.binding_range(
    min=year_min,
    max=year_max,
    step=year_step,
    name="Year: ",
)
year_param = alt.param(
    name="selected_year",
    value=year_min,
    bind=year_slider,
)

# Colour scheme: one hue per region
region_domain = sorted(df["region"].unique())
region_range  = ["#e41a1c", "#377eb8", "#4daf4a", "#ff7f00", "#984ea3"]

chart = (
    alt.Chart(df)
    .mark_circle(opacity=0.75, stroke="white", strokeWidth=0.5)
    .add_params(year_param)
    .transform_filter("datum.year == selected_year")
    .encode(
        x=alt.X(
            "gdp_per_capita:Q",
            scale=alt.Scale(type="log", base=10, domain=[100, 80000]),
            axis=alt.Axis(
                title="GDP per capita (USD, log scale)",
                tickCount=6,
                format="$,.0f",
                grid=True,
            ),
        ),
        y=alt.Y(
            "life_expectancy:Q",
            scale=alt.Scale(domain=[30, 86]),
            axis=alt.Axis(
                title="Life expectancy (years)",
                grid=True,
            ),
        ),
        size=alt.Size(
            "population:Q",
            scale=alt.Scale(range=[80, 3000]),
            legend=alt.Legend(
                title="Population",
                format=".2s",
                clipHeight=18,
            ),
        ),
        color=alt.Color(
            "region:N",
            scale=alt.Scale(domain=region_domain, range=region_range),
            legend=alt.Legend(title="Region"),
        ),
        tooltip=[
            alt.Tooltip("country:N",         title="Country"),
            alt.Tooltip("year:O",            title="Year"),
            alt.Tooltip("region:N",          title="Region"),
            alt.Tooltip("gdp_per_capita:Q",  title="GDP per capita (USD)", format="$,.0f"),
            alt.Tooltip("life_expectancy:Q", title="Life expectancy",      format=".1f"),
            alt.Tooltip("population:Q",      title="Population",           format=","),
        ],
    )
    .properties(
        width=760,
        height=480,
        title=alt.TitleParams(
            text="Gapminder Bubble Chart",
            subtitle="Wealth vs Health · Bubble size = population · Drag the slider to change year",
            fontSize=20,
            subtitleFontSize=13,
            anchor="start",
        ),
    )
    .configure_view(stroke=None)
    .configure_axis(labelFontSize=11, titleFontSize=13)
    .configure_legend(labelFontSize=11, titleFontSize=12)
)

# ---------------------------------------------------------------------------
# 3.  Save as a self-contained HTML file
# ---------------------------------------------------------------------------
out_path = "/home/user/project/gapminder.html"
# inline=True bundles vega/vega-lite/vega-embed JS into the HTML so the file
# works completely offline (requires vl-convert-python).
chart.save(out_path, inline=True, embed_options={"renderer": "svg"})
print(f"\nSaved → {out_path}")
