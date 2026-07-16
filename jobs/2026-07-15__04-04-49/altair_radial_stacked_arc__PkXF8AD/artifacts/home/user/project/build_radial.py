"""Build a radial stacked-arc dashboard with Vega-Altair and save to HTML."""

import altair as alt
import pandas as pd

# Inline dataset (no remote fetches)
data = pd.DataFrame(
    {
        "source": [
            "Organic Search",
            "Direct",
            "Referral",
            "Social",
            "Email",
            "Paid Ads",
        ],
        "visits": [3120, 1980, 1520, 1360, 880, 640],
    }
)

# Shared categorical color encoding using the tableau20 scheme
color_enc = alt.Color(
    "source:N",
    scale=alt.Scale(scheme="tableau20"),
    legend=alt.Legend(title="Traffic Source"),
)

# ---------- Left view: layered donut + label ring ----------
left_arc = (
    alt.Chart(data)
    .mark_arc(innerRadius=60)
    .encode(
        theta=alt.Theta("visits:Q"),                 # default additive stacking
        radius=alt.Radius("visits:Q", scale=alt.Scale(type="sqrt")),
        color=color_enc,
    )
)

left_text = (
    alt.Chart(data)
    .mark_text(radius=205, size=12)
    .encode(
        theta=alt.Theta("visits:Q"),
        text="source:N",
        color=alt.value("black"),
    )
)

left = alt.layer(left_arc, left_text).properties(
    title="Channel Volume (Donut)",
)

# ---------- Right view: normalized share of total ----------
right = (
    alt.Chart(data)
    .mark_arc(innerRadius=60)
    .encode(
        theta=alt.Theta("visits:Q", stack="normalize"),
        radius=alt.value(180),
        color=alt.Color(
            "source:N",
            scale=alt.Scale(scheme="tableau20"),
            legend=None,  # avoid duplicate legend; left view owns it
        ),
    )
    .properties(title="Share of Total (Normalized)")
)

# ---------- Compose horizontally ----------
chart = alt.hconcat(left, right).resolve_scale(color="shared").properties(
    title="Traffic Source Distribution",
)

# Save as a standalone HTML file
chart.save("/home/user/project/radial.html")
print("Saved /home/user/project/radial.html")
