# Interactive Scatterplot Matrix with a Shared Brush (Vega-Altair)

## Background
You are building an exploratory data-analysis artifact for a factory quality team using the declarative visualization library **Vega-Altair** (Altair 5+). The team wants a single interactive scatterplot matrix (SPLOM) that lets an analyst rubber-band a region of interest in *any* panel and instantly see the same set of specimens highlighted across *every* panel of the matrix, color-coded by machine class. The final artifact is a self-contained HTML file that renders in any browser with no network access.

A local dataset has already been provisioned for you (see below). It contains four quantitative sensor features and one categorical group column.

## Requirements
- Load the provided local CSV dataset with pandas (do **not** fetch any remote dataset or URL; the artifact must be fully offline).
- Build a **scatterplot matrix (SPLOM)** using Altair's `repeat` operator over the four quantitative features so every feature is plotted against every other feature (features used for both the repeated rows and the repeated columns).
- Add a **single shared interval selection (brush)**. When the analyst drags a rectangle in one panel, the brushed specimens must be highlighted in *all* panels at once (one global brush, not an independent brush per panel).
- Encode color with a **conditional encoding**: specimens inside the current brush are colored by their categorical machine class, while specimens outside the brush are rendered in a neutral light-gray.
- Save the finished chart as a **fully self-contained HTML** file that embeds both the Vega-Lite spec and its JavaScript dependencies inline, so it renders in a browser with **no internet access** (no CDN fetches).

## Implementation Hints
- Project path: `/home/user/altair_splom`
- Input dataset (already provided, do not modify): `/home/user/altair_splom/data/measurements.csv` with columns `temperature`, `pressure`, `humidity`, `vibration` (all quantitative) and `machine_class` (categorical, values `A`, `B`, `C`).
- Output artifact: `/home/user/altair_splom/chart.html` — ensure the generation script is actually executed and this file exists.
- The four quantitative feature columns `temperature`, `pressure`, `humidity`, and `vibration` must each appear in **both** the repeated `row` list and the repeated `column` list of the SPLOM.
- The repeated x/y encodings must be typed as quantitative, and both bind to the repeated field (column for x, row for y).
- There must be exactly **one** interval selection parameter, defined once on the repeated spec so it is shared globally across all panels (dragging in any panel updates the highlight everywhere).
- The `color` channel must be a conditional encoding driven by that brush: inside the selection use the `machine_class` field (nominal), otherwise a constant light-gray value (e.g. `lightgray`).
- Feed Altair a pandas DataFrame so the data is embedded inline in the saved HTML (no external data reference).
- The saved HTML must be fully self-contained: it must NOT reference any remote CDN for its JavaScript libraries and must render the matrix in a browser (with no network access) without JavaScript errors.

