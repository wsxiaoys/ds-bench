#!/usr/bin/env python3
"""Build a layered Altair chart showing raw jittered observations, group means,
and 95% bootstrapped confidence-interval error bars for four treatment groups.

Running this script (re)generates a standalone, self-contained HTML file at
output/chart.html with the data embedded inline.

    python3 build_chart.py
"""

import io
import os
import re
import urllib.request

import numpy as np
import pandas as pd
import altair as alt

# --- Paths -----------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "measurements.csv")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "chart.html")

# Reproducible jitter so re-runs produce a stable figure.
RNG_SEED = 42


def load_data(path: str) -> pd.DataFrame:
    """Read the experiment CSV and add a horizontal jitter column."""
    df = pd.read_csv(path)
    # Ensure group is treated as categorical and ordered A->D.
    df["group"] = pd.Categorical(df["group"], categories=["A", "B", "C", "D"], ordered=True)
    df = df.sort_values("group").reset_index(drop=True)

    # Horizontal jitter: a small random offset (in band-relative units) applied
    # via the xOffset channel so overlapping raw points become visible.
    rng = np.random.default_rng(RNG_SEED)
    df["jitter"] = rng.uniform(-0.35, 0.35, size=len(df))
    return df


def build_chart(df: pd.DataFrame) -> alt.LayerChart:
    """Compose the three layers into a single layered Altair chart."""

    x = alt.X("group:O", title="Treatment group", sort=["A", "B", "C", "D"])
    y = alt.Y("response:Q", title="Measured response")

    # Layer 1: raw observations, horizontally jittered via xOffset.
    raw_points = alt.Chart(df).mark_circle(
        opacity=0.45,
        size=30,
        color="#4c78a8",
    ).encode(
        x=x,
        y=y,
        xOffset=alt.XOffset("jitter:Q", scale=alt.Scale(domain=[-0.35, 0.35], range=[-12, 12])),
        tooltip=["group:O", "response:Q"],
    )

    # Layer 2: mean of each group as a prominent point marker.
    mean_points = alt.Chart(df).mark_point(
        filled=True,
        color="#e45756",
        size=120,
        strokeWidth=1.5,
    ).encode(
        x=x,
        y=alt.Y("response:Q", aggregate="mean", title="Measured response"),
        tooltip=[alt.Tooltip("response:Q", aggregate="mean", title="mean")],
    )

    # Layer 3: 95% confidence-interval error bars ("ci" extent == 95% CI).
    error_bars = alt.Chart(df).mark_errorbar(
        extent="ci",
        color="#e45756",
        thickness=2,
    ).encode(
        x=x,
        y=alt.Y("response:Q", title="Measured response"),
    )

    chart = alt.layer(
        raw_points,
        error_bars,
        mean_points,
    ).properties(
        width=480,
        height=340,
        title="Treatment response: raw observations, means, and 95% CI",
    ).configure_view(stroke=None)

    return chart


def _make_selfcontained(html: str) -> str:
    """Inline any external <script src="..."> references so the HTML document
    has no remote dependencies (JS libraries *and* data embedded inline)."""

    def _replace(match: re.Match) -> str:
        url = match.group(1)
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:  # noqa: S310
                js = resp.read().decode("utf-8")
            return f'<script>\n// inlined from {url}\n{js}\n</script>'
        except Exception as exc:  # noqa: BLE001
            # If a library can't be fetched, keep the remote reference so the
            # chart still renders when viewed online.
            print(f"  warning: could not inline {url}: {exc}")
            return match.group(0)

    script_re = re.compile(r'<script\b[^>]*?\ssrc="([^"]+)"[^>]*>\s*</script>', re.IGNORECASE)
    return script_re.sub(_replace, html)


def main() -> None:
    df = load_data(DATA_PATH)
    chart = build_chart(df)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Altair's default HTML save embeds the Vega-Lite spec *and* the data inline
    # as JSON; the only external references are the Vega/Vega-Lite/Vega-Embed JS
    # libraries loaded from a CDN. We inline those too so the output is a fully
    # standalone, self-contained HTML document with no remote references.
    buffer = io.StringIO()
    chart.save(buffer, format="html")
    html = _make_selfcontained(buffer.getvalue())

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"Saved standalone chart to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()