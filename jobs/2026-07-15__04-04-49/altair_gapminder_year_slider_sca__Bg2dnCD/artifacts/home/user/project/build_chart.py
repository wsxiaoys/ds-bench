"""
Build an interactive Gapminder-style bubble scatter plot with Vega-Altair.

The data is generated entirely in-memory (no network access required) and the
chart is written to a single self-contained HTML file that includes:
  - x = GDP per capita (log scale)
  - y = life expectancy
  - size = population
  - color = region
  - tooltip showing country and underlying values
  - a year slider bound to an Altair variable parameter that filters the marks
"""

import pandas as pd
import altair as alt


# ---------------------------------------------------------------------------
# 1. Build a tidy/long Gapminder-style DataFrame in memory.
#    One row per (country, year). Values are realistic approximations of the
#    classic Gapminder dataset so the chart looks plausible.
# ---------------------------------------------------------------------------

YEARS = [1952, 1962, 1972, 1982, 1992, 2002, 2007]

# Each tuple is (country, region, [gdp per capita over years],
#                 [life expectancy over years], [population over years])
COUNTRIES = [
    # Africa
    ("Nigeria",      "Africa",   [1018, 1150, 1240, 1450, 1620, 1750, 2010],
                               [36.3, 39.3, 42.4, 45.5, 47.0, 47.5, 47.0],
                               [33_119_096, 41_882_051, 55_045_117, 73_552_933,
                                95_542_792, 119_846_449, 135_031_164]),
    ("Egypt",        "Africa",   [1419, 1693, 2056, 2616, 3274, 4757, 5512],
                               [42.0, 47.0, 51.5, 56.0, 62.0, 68.0, 71.3],
                               [22_213_402, 28_161_787, 35_466_011, 44_320_367,
                                56_316_952, 70_244_278, 80_256_683]),
    ("South Africa", "Africa",   [4720, 5490, 7300, 8600, 8150, 8580, 9260],
                               [45.0, 49.0, 53.0, 56.0, 58.0, 53.0, 49.3],
                               [14_249_014, 17_240_746, 21_116_968, 25_535_080,
                                40_536_896, 46_625_873, 49_991_300]),
    ("Kenya",        "Africa",   [ 740,  840,  960, 1080, 1220, 1480, 1760],
                               [42.0, 46.0, 50.0, 54.0, 57.0, 56.0, 54.5],
                               [ 6_462_797,  8_510_799, 11_240_716, 15_417_584,
                                20_678_553, 30_121_769, 36_913_412]),
    ("Ethiopia",     "Africa",   [ 320,  380,  440,  490,  540,  610,  690],
                               [36.0, 40.0, 44.0, 48.0, 50.0, 53.0, 55.0],
                               [18_294_799, 22_593_772, 27_494_228, 33_542_063,
                                53_151_862, 67_284_062, 76_511_887]),

    # Americas
    ("United States", "Americas", [13990, 16770, 21800, 25800, 32050, 39000, 42950],
                                [68.0, 70.0, 71.5, 73.5, 75.5, 77.0, 78.2],
                                [157_553_000, 186_538_000, 209_896_000, 232_187_000,
                                 256_894_000, 287_675_000, 301_139_000]),
    ("Brazil",       "Americas",  [2100, 2850, 4150, 5400, 6800, 8100, 9100],
                                [50.0, 56.0, 60.0, 64.0, 67.5, 70.5, 72.4],
                                [ 56_637_528, 73_174_620, 93_560_015, 119_491_983,
                                 154_584_000, 185_564_212, 190_010_647]),
    ("Mexico",       "Americas",  [3050, 3920, 5150, 6700, 8400, 10750, 12100],
                                [50.8, 57.5, 62.5, 67.0, 71.5, 74.5, 76.2],
                                [ 26_144_353, 33_654_981, 44_521_899, 58_129_108,
                                 78_111_092, 99_175_966, 105_797_000]),
    ("Argentina",    "Americas",  [5050, 5680, 6450, 7700, 8800, 10700, 12800],
                                [62.5, 65.0, 67.0, 69.5, 72.0, 74.0, 75.3],
                                [ 17_850_121, 21_418_812, 24_505_511, 28_241_626,
                                 33_030_513, 37_632_843, 40_301_927]),
    ("Canada",       "Americas",  [10070, 13130, 17520, 21500, 25600, 31400, 36000],
                                [68.8, 71.0, 73.0, 75.5, 78.0, 79.5, 80.7],
                                [ 14_796_600, 18_591_000, 22_082_000, 24_892_000,
                                 27_742_000, 31_306_000, 33_390_000]),

    # Asia
    ("China",        "Asia",      [ 400,  520,  780, 1150, 1850, 3500, 4950],
                                [44.0, 50.0, 58.0, 64.0, 68.0, 71.5, 73.0],
                                [ 556_263_000,  665_770_000,  862_030_000, 1_000_860_000,
                                 1_164_970_000, 1_285_000_000, 1_318_000_000]),
    ("India",        "Asia",      [ 590,  680,  780,  930, 1180, 1750, 2450],
                                [37.0, 42.0, 48.0, 55.0, 60.0, 63.0, 64.7],
                                [ 372_000_000,  447_000_000,  567_000_000,  717_000_000,
                                 880_000_000, 1_050_000_000, 1_110_000_000]),
    ("Japan",        "Asia",      [3210, 5750, 12100, 16500, 21000, 26800, 31200],
                                [63.0, 68.0, 73.0, 76.5, 79.0, 81.0, 82.6],
                                [ 86_400_000,  94_950_000, 105_140_000, 118_450_000,
                                 124_330_000, 127_065_000, 127_467_000]),
    ("Indonesia",    "Asia",      [ 750,  870, 1100, 1500, 2100, 2900, 3500],
                                [37.0, 44.0, 51.0, 58.0, 64.0, 68.0, 70.6],
                                [ 82_030_000,  99_055_000, 122_310_000, 152_850_000,
                                 184_785_000, 211_540_000, 223_547_000]),
    ("South Korea",  "Asia",      [1030, 1480, 3120, 7400, 13500, 18800, 22000],
                                [47.0, 55.0, 62.0, 66.5, 72.5, 77.5, 79.8],
                                [ 20_240_000,  26_330_000,  33_510_000,  39_170_000,
                                 44_550_000,  47_580_000,  49_448_000]),

    # Europe
    ("Germany",      "Europe",    [5100, 8200, 14200, 18800, 23600, 28500, 32100],
                                [67.5, 70.0, 71.5, 73.5, 76.0, 78.0, 79.4],
                                [ 69_460_000,  74_030_000,  78_350_000,  79_580_000,
                                 80_600_000,  81_870_000,  82_370_000]),
    ("France",       "Europe",    [4900, 7800, 12800, 17500, 22000, 27500, 29700],
                                [67.0, 70.0, 72.0, 74.5, 77.0, 79.0, 80.7],
                                [ 43_590_000,  47_140_000,  51_620_000,  54_380_000,
                                 57_180_000,  60_180_000,  61_530_000]),
    ("United Kingdom","Europe",   [6900, 9800, 13500, 17000, 21500, 28400, 32200],
                                [69.0, 71.0, 72.0, 74.0, 76.5, 78.0, 79.4],
                                [ 50_430_000,  52_680_000,  55_840_000,  56_350_000,
                                 57_580_000,  59_090_000,  60_780_000]),
    ("Italy",        "Europe",    [3550, 5800, 10100, 14500, 19000, 25500, 28500],
                                [65.0, 69.0, 71.5, 74.0, 77.0, 79.5, 80.5],
                                [ 47_710_000,  50_280_000,  54_010_000,  56_450_000,
                                 56_790_000,  57_380_000,  58_150_000]),
    ("Spain",        "Europe",    [3050, 4900, 8500, 12000, 16500, 24500, 28100],
                                [64.0, 69.0, 72.0, 75.5, 78.0, 80.0, 80.9],
                                [ 28_530_000,  31_150_000,  34_190_000,  37_850_000,
                                 39_550_000,  41_190_000,  43_750_000]),

    # Oceania
    ("Australia",    "Oceania",   [10070, 13200, 17200, 21100, 24000, 30200, 34400],
                                [69.0, 70.5, 72.0, 74.5, 77.5, 80.0, 81.2],
                                [  8_690_000,  10_750_000,  13_170_000,  15_180_000,
                                 17_490_000,  19_540_000,  20_430_000]),
    ("New Zealand",  "Oceania",   [ 8520, 11700, 15100, 17500, 19100, 24000, 27300],
                                [69.4, 71.0, 72.5, 74.0, 77.0, 79.0, 80.2],
                                [  1_990_000,   2_450_000,   2_890_000,   3_150_000,
                                 3_440_000,   3_890_000,   4_180_000]),
]

records = []
for country, region, gdps, lifes, pops in COUNTRIES:
    for year, gdp, life, pop in zip(YEARS, gdps, lifes, pops):
        records.append({
            "year": int(year),
            "country": country,
            "region": region,
            "gdp_per_capita": float(gdp),
            "life_expectancy": float(life),
            "population": int(pop),
        })

df = pd.DataFrame.from_records(records)

# Sanity checks: at least 5 distinct years, at least 4 distinct regions.
assert df["year"].nunique() >= 5, "Need at least 5 distinct years"
assert df["region"].nunique() >= 4, "Need at least 4 distinct regions"
assert set(df.columns) == {"year", "country", "region",
                           "gdp_per_capita", "life_expectancy", "population"}

# Keep the dataset small enough to embed inline without bumping into Altair's
# default 5000-row limit (we have 25 * 7 = 175 rows anyway).
alt.data_transformers.disable_max_rows()


# ---------------------------------------------------------------------------
# 2. Build the chart with a year slider bound to an Altair parameter.
# ---------------------------------------------------------------------------

year_min = int(df["year"].min())
year_max = int(df["year"].max())
year_step = 5  # the YEARS list is in 10-year gaps; 5 keeps every value reachable

# A variable parameter bound to a range-input slider.  Moving the slider sets
# `year_param`'s value, which drives the transform_filter below.
year_param = alt.param(
    value=year_max,
    bind=alt.binding_range(
        min=year_min,
        max=year_max,
        step=year_step,
        name="Year: ",
    ),
)

chart = (
    alt.Chart(df, title="Wealth vs. Health (Gapminder)")
    .mark_circle(opacity=0.75, stroke="#333", strokeWidth=0.5)
    .encode(
        x=alt.X(
            "gdp_per_capita:Q",
            title="GDP per capita (USD, log scale)",
            scale=alt.Scale(type="log", base=10, domain=[200, 60000]),
            axis=alt.Axis(format="~s"),
        ),
        y=alt.Y(
            "life_expectancy:Q",
            title="Life expectancy (years)",
            scale=alt.Scale(zero=False, domain=[30, 90]),
        ),
        size=alt.Size(
            "population:Q",
            title="Population",
            scale=alt.Scale(range=[25, 1500]),
            legend=alt.Legend(format="~s"),
        ),
        color=alt.Color(
            "region:N",
            title="Region",
            scale=alt.Scale(scheme="category10"),
        ),
        tooltip=[
            alt.Tooltip("country:N", title="Country"),
            alt.Tooltip("region:N", title="Region"),
            alt.Tooltip("year:O", title="Year"),
            alt.Tooltip("gdp_per_capita:Q", title="GDP / capita",
                        format="$,.0f"),
            alt.Tooltip("life_expectancy:Q", title="Life expectancy",
                        format=".1f"),
            alt.Tooltip("population:Q", title="Population",
                        format=",.0f"),
        ],
    )
    .add_params(year_param)
    .transform_filter(alt.datum.year == year_param)
    .properties(
        width=850,
        height=520,
        background="#fafafa",
    )
)


# ---------------------------------------------------------------------------
# 3. Save to a single self-contained HTML file (data is embedded inline).
# ---------------------------------------------------------------------------

OUTPUT_PATH = "/home/user/project/gapminder.html"
# inline=True bundles Vega / Vega-Lite / Vega-Embed JS into the file so the
# resulting HTML renders correctly with no network access.
chart.save(OUTPUT_PATH, inline=True)

print(f"Rows in dataset: {len(df)}")
print(f"Years: {sorted(df['year'].unique().tolist())}")
print(f"Regions: {sorted(df['region'].unique().tolist())}")
print(f"Countries per region:")
for region, group in df.groupby("region"):
    print(f"  {region}: {group['country'].nunique()} countries")
print(f"Wrote {OUTPUT_PATH}")