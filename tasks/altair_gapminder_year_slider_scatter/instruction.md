# Gapminder Bubble Scatter with an Interactive Year Slider (Vega-Altair)

## Background
You are building a self-contained, offline data-visualization artifact with the Vega-Altair Python library (Altair 5+). The goal is a classic "Gapminder" style animated-by-slider bubble chart: each bubble is a country, positioned by wealth and health, sized by population and colored by region, with a slider that lets the viewer scrub through years. The whole thing must render as a single static HTML file that works in a browser with no network access.

## Requirements
- Build a bubble scatter plot where each mark is a country in a given year:
  - x = GDP per capita, drawn on a **logarithmic** scale.
  - y = life expectancy.
  - bubble **size** encodes population.
  - bubble **color** encodes region.
  - a **tooltip** shows the country and its underlying values.
- Add a **year slider** (a range-input widget) bound to an Altair parameter. Moving the slider must filter the chart so that only the marks for the selected year are shown.
- Save the finished chart as an HTML file that renders correctly offline.

## Implementation Hints
- Project path: /home/user/project
- Command: `python3 build_chart.py`
- Output file: `/home/user/project/gapminder.html`
- The dataset MUST be generated/bundled **locally inside your program** (e.g. build a pandas DataFrame in code, or read a local file you create). Do NOT download anything, do NOT use `vega_datasets` remote URLs, and do NOT reference any `http(s)` data source — the environment has no internet and the final HTML must embed its data inline.
- The data must be *tidy/long* (one row per country-per-year) and must contain at least **5 distinct years** and at least **4 distinct regions**, with several countries per region. Each row must use exactly these column names: `year` (integer), `country`, `region`, `gdp_per_capita`, `life_expectancy`, and `population`.
- Use a variable parameter bound to a range slider for the year control, and a filter transform so the visible marks are restricted to the currently selected year. The slider's min/max/step must span the years present in the data so every year is reachable.
- Use Altair's chart-saving capability to write the HTML; the resulting file must be viewable in a browser with the bubbles rendered and the year slider present.
- Keep the row count well under Altair's default limit so the data embeds inline without extra configuration.

