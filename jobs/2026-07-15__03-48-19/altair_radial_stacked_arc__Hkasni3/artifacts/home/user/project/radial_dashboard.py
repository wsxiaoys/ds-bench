"""
Radial Stacked Arc Dashboard with Vega-Altair.

Builds a single-page radial dashboard from a locally defined dataset of
website traffic sources. The dashboard is composed of two views combined
side by side:

  * Left  : a layered radial arc (donut) where the angular extent (theta)
            encodes the stacked visit count and the radial extent (radius)
            encodes the visit magnitude (sqrt scale), with a text label
            ring layered on top of the arcs.
  * Right : a companion normalized radial arc where the angle of each
            channel represents its share of the total (sums to 100%).

Both views share the same categorical color scheme (`tableau20`) and a
legend titled "Traffic Source".

The composed chart is saved as a standalone HTML file that embeds the
full Vega-Lite spec, so the file is fully self-contained and never needs
to fetch any remote dataset.
"""

import altair as alt
import pandas as pd

# ---------------------------------------------------------------------------
# Locally defined dataset (no remote / vega_datasets sources).
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# Shared color encoding: nominal `source` with the categorical tableau20
# scheme and a legend titled "Traffic Source". Reused in both views so the
# colors are consistent across the dashboard.
# ---------------------------------------------------------------------------
color = alt.Color(
    "source:N",
    scale=alt.Scale(scheme="tableau20"),
    legend=alt.Legend(title="Traffic Source"),
)

# ---------------------------------------------------------------------------
# Left view: layered radial arc (donut) + text label ring.
#   * Bottom layer (arc): theta encodes `visits` as a stacked quantitative
#     value (default additive stacking, stack="zero"), radius encodes
#     `visits` with a sqrt scale, and a non-zero innerRadius makes it a donut.
#   * Top layer (text): a label ring where the text channel is the `source`
#     field, placed at the angular center of each arc segment (stack="center")
#     and at a fixed radius just outside the arcs.
# ---------------------------------------------------------------------------
arc = (
    alt.Chart(data)
    .mark_arc(innerRadius=20)
    .encode(
        theta=alt.Theta("visits:Q", stack="zero"),
        radius=alt.Radius(
            "visits:Q",
            scale=alt.Scale(type="sqrt", range=[20, 120]),
        ),
        color=color,
    )
)

labels = (
    alt.Chart(data)
    .mark_text()
    .encode(
        theta=alt.Theta("visits:Q", stack="center"),
        radius=alt.value(135),
        text="source:N",
    )
)

left_view = arc + labels
left_view = left_view.properties(title="Visits by Channel (stacked magnitude)")

# ---------------------------------------------------------------------------
# Right view: normalized radial arc.
#   * arc mark whose theta encodes `visits` with normalized stacking, so the
#     angles represent each channel's share of the total (ring sums to 100%).
# ---------------------------------------------------------------------------
right_view = (
    alt.Chart(data)
    .mark_arc(innerRadius=20)
    .encode(
        theta=alt.Theta("visits:Q", stack="normalize"),
        color=color,
    )
    .properties(title="Share of Total (normalized)")
)

# ---------------------------------------------------------------------------
# Combine the two views side by side (horizontal concatenation) and save as a
# standalone HTML file embedding the Vega-Lite spec.
# ---------------------------------------------------------------------------
dashboard = alt.hconcat(left_view, right_view).properties(
    title="Website Traffic by Acquisition Channel"
)

output_path = "/home/user/project/radial.html"
dashboard.save(output_path)

print(f"Saved standalone dashboard to {output_path}")