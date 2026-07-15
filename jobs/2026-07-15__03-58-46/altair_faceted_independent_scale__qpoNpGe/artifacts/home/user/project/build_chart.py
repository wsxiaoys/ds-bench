import pandas as pd
import altair as alt

# ── 1. Load data ──────────────────────────────────────────────────────────────
df = pd.read_csv("metrics.csv", parse_dates=["date"])

# ── 2. Shared hover selection (nearest point on pointer-over) ─────────────────
hover = alt.selection_point(
    name="hover",
    on="pointerover",
    nearest=True,
    fields=["date"],
    empty=False,
)

# ── 3. Base chart (applied inside every facet panel) ─────────────────────────
base = (
    alt.Chart(df)
    .encode(
        x=alt.X("date:T", title="Date"),
        y=alt.Y("value:Q", title="Value"),
        color=alt.Color("series:N", title="Series"),   # shared color scale
    )
)

# Solid line per panel
lines = base.mark_line()

# Invisible wide stroke to make hovering easier
selectors = (
    base.mark_point(opacity=0)
    .encode(opacity=alt.value(0))
    .add_params(hover)
)

# Visible dot that snaps to the hovered nearest point
points = base.mark_point(size=80, filled=True).encode(
    opacity=alt.condition(hover, alt.value(1), alt.value(0))
)

# Tooltip rule + text
rules = (
    alt.Chart(df)
    .mark_rule(color="gray", strokeDash=[4, 4])
    .encode(
        x="date:T",
        tooltip=[
            alt.Tooltip("date:T", title="Date", format="%Y-%m-%d"),
            alt.Tooltip("value:Q", title="Value", format=".4~g"),
            alt.Tooltip("series:N", title="Series"),
        ],
    )
    .transform_filter(hover)
)

# Layer everything into a single inner chart
inner = alt.layer(lines, selectors, points, rules)

# ── 4. Facet into a 2-column wrapped grid ─────────────────────────────────────
chart = (
    inner.facet(
        facet=alt.Facet("series:N", title=None),
        columns=2,
    )
    .resolve_scale(
        y="independent",   # each panel gets its own y-axis range
        color="shared",    # one consistent color mapping + single legend
    )
    .properties(
        title=alt.TitleParams(
            text="Web Service Metrics Dashboard",
            fontSize=18,
            anchor="middle",
        )
    )
)

# ── 5. Save as a fully self-contained standalone HTML file ────────────────────
chart.save("chart.html", embed_options={"renderer": "svg"})
print("chart.html written successfully.")
