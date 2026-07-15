"""
Build a self-contained, offline-capable Altair 6 dashboard.

Views:
  1. Stacked bar chart  – total monthly sales per category
                          legend-bound point selection + conditional opacity
  2. Time-series lines  – monthly sales per category
                          filter transform driven by the same selection

The two views share one `selection_point` parameter bound to the colour legend.
Saved with `inline=True` so all Vega/Vega-Lite/vega-embed JS is embedded and
the file renders with zero network access.
"""

import csv
import pathlib
import altair as alt

# ---------------------------------------------------------------------------
# 1. Load the CSV data
# ---------------------------------------------------------------------------
DATA_PATH   = pathlib.Path("/home/user/project/data/sales.csv")
OUTPUT_PATH = pathlib.Path("/home/user/project/dashboard.html")

records: list[dict] = []
with DATA_PATH.open(newline="") as fh:
    for row in csv.DictReader(fh):
        records.append({
            "date":     row["date"],        # "YYYY-MM-DD"  (ISO, first of month)
            "category": row["category"],
            "sales":    int(row["sales"]),
        })

# ---------------------------------------------------------------------------
# 2. Shared colour scale and selection
# ---------------------------------------------------------------------------
COLOR_SCALE = alt.Scale(
    domain=["Clothing", "Electronics", "Furniture", "Groceries"],
    range= ["#e07b39", "#4c78a8", "#72b7b2", "#54a24b"],
)

# Point selection projected on "category" and bound to the colour legend.
# When nothing is selected the selection is empty (empty=True default) which
# means the condition evaluates to True for every row → all bars fully opaque,
# all lines visible.
cat_select = alt.selection_point(
    name="cat_select",
    fields=["category"],
    bind="legend",
)

# Shared x encoding (month)
x_enc = alt.X(
    "yearmonth(date):T",
    title="Month",
    axis=alt.Axis(format="%b %Y", labelAngle=-45),
)

# ---------------------------------------------------------------------------
# 3. Stacked bar chart
# ---------------------------------------------------------------------------
bar = (
    alt.Chart(alt.InlineData(values=records))  # inline → no CSV path in spec
    .mark_bar()
    .encode(
        x=x_enc,
        y=alt.Y(
            "sum(sales):Q",
            title="Total Sales",
            stack="zero",
        ),
        color=alt.Color(
            "category:N",
            scale=COLOR_SCALE,
            title="Category",
            legend=alt.Legend(title="Category — click to filter"),
        ),
        # Conditional opacity: selected category → 1.0 ; others → 0.15
        opacity=alt.condition(cat_select, alt.value(1.0), alt.value(0.15)),
        tooltip=[
            alt.Tooltip("category:N",        title="Category"),
            alt.Tooltip("yearmonth(date):T",  title="Month",       format="%b %Y"),
            alt.Tooltip("sum(sales):Q",       title="Total Sales"),
        ],
    )
    .properties(
        title="Monthly Sales by Category (Stacked)",
        width=720,
        height=310,
    )
    # Attach the selection to this view (it drives the legend here)
    .add_params(cat_select)
)

# ---------------------------------------------------------------------------
# 4. Time-series line chart
# ---------------------------------------------------------------------------
line = (
    alt.Chart(alt.InlineData(values=records))
    .transform_filter(cat_select)          # only the selected category is drawn
    .mark_line(point=True, strokeWidth=2.5)
    .encode(
        x=x_enc,
        y=alt.Y("sales:Q", title="Sales"),
        color=alt.Color(
            "category:N",
            scale=COLOR_SCALE,
            legend=None,            # legend lives only on the bar view
        ),
        tooltip=[
            alt.Tooltip("category:N",       title="Category"),
            alt.Tooltip("yearmonth(date):T", title="Month",  format="%b %Y"),
            alt.Tooltip("sales:Q",           title="Sales"),
        ],
    )
    .properties(
        title="Monthly Sales Trend  (click legend above to focus a category)",
        width=720,
        height=260,
    )
)

# ---------------------------------------------------------------------------
# 5. Compose and save
# ---------------------------------------------------------------------------
dashboard = (
    alt.vconcat(bar, line)
    .resolve_scale(color="shared")
    .properties(
        title=alt.TitleParams(
            text="Retail Sales Dashboard",
            subtitle="Click a legend entry to focus · click again to clear",
            fontSize=22,
            subtitleFontSize=13,
            anchor="start",
        )
    )
    .configure_view(stroke="transparent")
    .configure(background="#fafafa", font="system-ui, sans-serif")
)

# inline=True  →  Vega / Vega-Lite / vega-embed JS are embedded in the file
dashboard.save(
    OUTPUT_PATH,
    format="html",
    inline=True,
    embed_options={"renderer": "canvas", "actions": True},
)

size_kb = OUTPUT_PATH.stat().st_size / 1024
print(f"[OK] Saved: {OUTPUT_PATH}  ({size_kb:,.0f} KB, fully self-contained)")
