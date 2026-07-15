import pandas as pd
import altair as alt

# 1. Define countries, regions, and their base characteristics in 1980
# Columns needed: year, country, region, gdp_per_capita, life_expectancy, population
# We will generate data for 1980, 1990, 2000, 2010, and 2020 (5 distinct years).
# There are 4 distinct regions, each with 5 countries (several countries per region).

countries_info = {
    # Country: (Region, 1980_gdp, 1980_life_exp, 1980_pop, gdp_growth_rate, life_exp_growth_rate, pop_growth_rate)
    # Africa
    "Nigeria": ("Africa", 850, 45.5, 73_400_000, 0.015, 0.28, 0.026),
    "Egypt": ("Africa", 1100, 56.0, 44_000_000, 0.025, 0.38, 0.020),
    "Kenya": ("Africa", 650, 54.0, 16_300_000, 0.012, 0.22, 0.028),
    "South Africa": ("Africa", 2900, 57.0, 29_100_000, 0.014, 0.15, 0.019),
    "Ethiopia": ("Africa", 400, 43.0, 35_200_000, 0.030, 0.52, 0.027),

    # Americas
    "United States": ("Americas", 12500, 73.7, 227_200_000, 0.021, 0.13, 0.009),
    "Brazil": ("Americas", 3400, 62.5, 121_700_000, 0.016, 0.31, 0.015),
    "Mexico": ("Americas", 3900, 66.8, 68_300_000, 0.014, 0.21, 0.017),
    "Canada": ("Americas", 11500, 75.1, 24_500_000, 0.019, 0.16, 0.010),
    "Argentina": ("Americas", 4500, 69.0, 28_100_000, 0.011, 0.18, 0.012),

    # Asia
    "China": ("Asia", 310, 65.5, 981_000_000, 0.082, 0.28, 0.010),
    "India": ("Asia", 380, 53.8, 697_000_000, 0.048, 0.38, 0.018),
    "Japan": ("Asia", 9200, 76.1, 116_800_000, 0.022, 0.19, 0.003),
    "Indonesia": ("Asia", 620, 52.2, 147_500_000, 0.039, 0.42, 0.016),
    "South Korea": ("Asia", 2300, 65.0, 38_100_000, 0.068, 0.41, 0.010),

    # Europe
    "Germany": ("Europe", 10800, 72.8, 78_300_000, 0.018, 0.20, 0.001),
    "United Kingdom": ("Europe", 9600, 73.7, 56_300_000, 0.020, 0.17, 0.003),
    "France": ("Europe", 10200, 74.0, 53_9_000_000, 0.019, 0.21, 0.005),
    "Italy": ("Europe", 8700, 74.0, 56_400_000, 0.017, 0.22, 0.002),
    "Spain": ("Europe", 6200, 75.3, 37_500_000, 0.021, 0.20, 0.004)
}

rows = []
years = [1980, 1990, 2000, 2010, 2020]

for country, info in countries_info.items():
    region, base_gdp, base_life_exp, base_pop, gdp_growth, life_exp_growth, pop_growth = info
    for y in years:
        t = y - 1980
        # Calculate values dynamically with realistic growth rates
        gdp = base_gdp * ((1 + gdp_growth) ** t)
        life_exp = base_life_exp + (life_exp_growth * t)
        pop = base_pop * ((1 + pop_growth) ** t)
        
        rows.append({
            "year": int(y),
            "country": country,
            "region": region,
            "gdp_per_capita": float(round(gdp, 2)),
            "life_expectancy": float(round(life_exp, 2)),
            "population": int(round(pop))
        })

df = pd.DataFrame(rows)

# 2. Build the Vega-Altair chart with interactive slider
# Create a slider widget bound to an Altair parameter
slider = alt.binding_range(min=1980, max=2020, step=10, name='Year: ')
select_year = alt.param(name='year_param', value=1980, bind=slider)

# Build the bubble scatter plot
chart = alt.Chart(df).mark_circle(
    opacity=0.75,
    stroke='black',
    strokeWidth=0.5
).encode(
    x=alt.X('gdp_per_capita:Q', 
            scale=alt.Scale(type='log', domain=[200, 60000]), 
            title='GDP per Capita (USD)',
            axis=alt.Axis(grid=True, format='$,.0f')),
    y=alt.Y('life_expectancy:Q', 
            scale=alt.Scale(zero=False, domain=[40, 90]), 
            title='Life Expectancy (years)',
            axis=alt.Axis(grid=True)),
    size=alt.Size('population:Q', 
                  scale=alt.Scale(range=[100, 3000]), 
                  title='Population',
                  legend=alt.Legend(format='.2s')),
    color=alt.Color('region:N', 
                    title='Region', 
                    scale=alt.Scale(scheme='set1')),
    tooltip=[
        alt.Tooltip('country:N', title='Country'),
        alt.Tooltip('region:N', title='Region'),
        alt.Tooltip('year:O', title='Year'),
        alt.Tooltip('gdp_per_capita:Q', title='GDP per Capita', format='$,.0f'),
        alt.Tooltip('life_expectancy:Q', title='Life Expectancy', format='.1f'),
        alt.Tooltip('population:Q', title='Population', format=',.0f')
    ]
).add_params(
    select_year
).transform_filter(
    alt.datum.year == select_year
).properties(
    width=800,
    height=500,
    title=alt.TitleParams(
        text="Gapminder Bubble Scatter Chart",
        subtitle=["Wealth and Health of Nations over Time (1980 - 2020)", 
                  "Drag the slider below to scrub through years. Bubble size represents population."],
        fontSize=18,
        subtitleFontSize=12,
        anchor='start',
        offset=15
    )
).configure_axis(
    labelFontSize=11,
    titleFontSize=12
).configure_legend(
    labelFontSize=11,
    titleFontSize=12
)

# 3. Save the finished chart as an HTML file that renders correctly offline
output_path = "/home/user/project/gapminder.html"
chart.save(output_path, inline=True)
print(f"Chart successfully saved to {output_path} with inline JS libraries.")
