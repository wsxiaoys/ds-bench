import altair as alt
import pandas as pd

# ── Dataset ──────────────────────────────────────────────────────────────────
data = pd.DataFrame({
    "source": [
        "Organic Search", "Direct", "Referral",
        "Social", "Email", "Paid Ads",
    ],
    "visits": [3120, 1980, 1520, 1360, 880, 640],
})

# ── Shared color encoding (tableau20, legend titled "Traffic Source") ─────────
color_enc = alt.Color(
    "source:N",
    scale=alt.Scale(scheme="tableau20"),
    legend=alt.Legend(title="Traffic Source"),
)

# ── Left view: layered donut arc + label ring ─────────────────────────────────
arc_layer = (
    alt.Chart(data)
    .mark_arc(innerRadius=50)
    .encode(
        theta=alt.Theta("visits:Q", stack=True),          # additive stacking
        radius=alt.Radius(
            "visits:Q",
            scale=alt.Scale(type="sqrt", zero=True, rangeMin=60),
        ),
        color=color_enc,
        tooltip=["source:N", "visits:Q"],
    )
)

text_layer = (
    alt.Chart(data)
    .mark_text(radiusOffset=18, fontSize=11)
    .encode(
        theta=alt.Theta("visits:Q", stack=True),
        radius=alt.Radius(
            "visits:Q",
            scale=alt.Scale(type="sqrt", zero=True, rangeMin=60),
        ),
        text=alt.Text("source:N"),
        color=color_enc,
    )
)

left_view = (
    alt.layer(arc_layer, text_layer)
    .properties(title="Visit Volume by Channel", width=340, height=340)
)

# ── Right view: normalized arc (share of total) ───────────────────────────────
right_view = (
    alt.Chart(data)
    .mark_arc(innerRadius=50)
    .encode(
        theta=alt.Theta("visits:Q", stack="normalize"),   # normalized stacking
        color=color_enc,
        tooltip=["source:N", "visits:Q"],
    )
    .properties(title="Channel Share (normalized)", width=340, height=340)
)

# ── Horizontal concatenation ──────────────────────────────────────────────────
dashboard = (
    alt.hconcat(left_view, right_view)
    .properties(title=alt.TitleParams(
        "Website Traffic — Acquisition Channel Breakdown",
        fontSize=18,
        anchor="middle",
    ))
    .resolve_scale(color="shared")   # single shared legend
    .configure_view(strokeWidth=0)
    .configure_title(fontSize=13)
)

# ── Save ──────────────────────────────────────────────────────────────────────
out_path = "/home/user/project/radial.html"
dashboard.save(out_path)
print(f"Saved → {out_path}")
