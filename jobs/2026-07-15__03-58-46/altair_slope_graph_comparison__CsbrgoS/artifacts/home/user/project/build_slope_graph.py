import altair as alt
import pandas as pd

# ── Load local data ──────────────────────────────────────────────────────────
df = pd.read_csv("/home/user/project/data/regional_revenue.csv")

# ── Base chart: fold the two year columns into long form ─────────────────────
#    After fold: each row has  region | year | revenue | revenue_2023 | revenue_2024
#    revenue_2023 / revenue_2024 remain available for the calculate transform.
base = (
    alt.Chart(df)
    .transform_fold(
        ["revenue_2023", "revenue_2024"],
        as_=["year", "revenue"],
    )
    # Classify each region's trend from the *original* wide columns
    .transform_calculate(
        trend="datum.revenue_2024 > datum.revenue_2023 ? 'Increased' : 'Decreased'"
    )
    .encode(
        x=alt.X(
            "year:N",
            axis=alt.Axis(title=None, labelAngle=0),
            scale=alt.Scale(padding=0.3),
        ),
        y=alt.Y(
            "revenue:Q",
            axis=alt.Axis(title="Annual Revenue (USD M)"),
            scale=alt.Scale(zero=False),
        ),
        # One distinct line per region (separating channel)
        detail="region:N",
        # Color encodes the computed trend (nominal → two distinct hues)
        color=alt.Color(
            "trend:N",
            scale=alt.Scale(
                domain=["Increased", "Decreased"],
                range=["#2ca02c", "#d62728"],   # green / red
            ),
            legend=alt.Legend(title="Revenue Trend"),
        ),
    )
)

# ── Layer 1: line connecting the two endpoints ───────────────────────────────
lines = base.mark_line(strokeWidth=2.5)

# ── Layer 2: points at both endpoints ───────────────────────────────────────
points = base.mark_point(filled=True, size=80)

# ── Layer 3: text labels at both endpoints ───────────────────────────────────
labels = base.mark_text(fontSize=11, dy=-12).encode(
    text=alt.Text("revenue:Q", format=".0f"),
)

# ── Compose and save ─────────────────────────────────────────────────────────
chart = (
    alt.layer(lines, points, labels)
    .properties(
        title="Regional Revenue: 2023 → 2024",
        width=400,
        height=350,
    )
    .configure_view(strokeWidth=0)
    .configure_title(fontSize=16, anchor="start")
)

chart.save("/home/user/project/slope_graph.html")
print("Saved → /home/user/project/slope_graph.html")
