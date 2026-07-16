"""Build a faceted small-multiple line chart of operational metrics.

Reads the long-form metrics data from metrics.csv and writes a standalone HTML
file (chart.html) that contains the full Vega-Lite/Vega specification and
embedded data, so it renders in a browser with no network access.
"""

import pandas as pd
import altair as alt

# Load the long-form metrics data. Altair will infer column types from the
# DataFrame: `date` will be parsed as a datetime, `series` as nominal,
# `value` as quantitative.
df = pd.read_csv("metrics.csv", parse_dates=["date"])

# A single shared hover selection drives every panel. Adding it to the
# inner (pre-facet) chart means the parameter and the tooltip are shared
# across facets rather than duplicated per panel.
hover = alt.selection_point(
    fields=["date"],
    nearest=True,
    on="pointerover",
    empty=False,
    clear="pointerout",
)

# Common encodings for the line + highlighted point layers.
common_enc = alt.Chart(df).encode(
    x=alt.X("date:T", title="Date"),
    y=alt.Y("value:Q", title="Value"),
    color=alt.Color("series:N", title="Series"),
)

# The base line layer is always visible (no hover filter).
lines = common_enc.mark_line()

# Nearest-point overlay: an invisible point layer registers the hover
# selection and supplies the tooltip. It carries the shared hover
# parameter so the same selection drives every panel.
selectors = (
    alt.Chart(df)
    .mark_point(opacity=0)
    .encode(
        x="date:T",
        y="value:Q",
        tooltip=["date:T", "value:Q"],
    )
    .add_params(hover)
)

# Highlighted point on the hovered date (only the one closest to the
# pointer becomes visible). Filters to the hovered date so only that
# point is drawn, and reveals it via the conditional opacity.
highlight = (
    common_enc.mark_point(size=80, filled=True)
    .encode(
        opacity=alt.condition(hover, alt.value(1), alt.value(0)),
        tooltip=["date:T", "value:Q"],
    )
    .transform_filter(hover)
)

# Wrap the small multiples in a 2-column grid. `facet(columns=2)` wraps
# four series into a 2x2 layout. Y scale resolution is set to
# independent so each panel uses its own range, while the color scale
# stays shared (the default).
inner = alt.layer(lines, selectors, highlight).properties(
    width=320,
    height=200,
)

chart = (
    inner.facet(
        facet=alt.Facet(
            "series:N",
            title=None,
            header=alt.Header(labelFontSize=12),
        ),
        columns=2,
    )
    .resolve_scale(y="independent", color="shared")
    .properties(title="Operational Metrics (small multiples)")
    .configure_view(stroke=None)
)

# Save as a self-contained HTML document (the spec + data are inlined).
chart.save("chart.html")
print("Wrote chart.html")
