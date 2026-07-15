#!/usr/bin/env python3
"""
Interactive Legend Cross-Filter Sales Dashboard Generator
This script loads sales data from a local CSV file, builds a linked Altair 
dashboard with a stacked bar chart and a time-series line chart sharing a 
single interactive legend, and saves it as a self-contained offline HTML file.
"""

import os
import warnings
import pandas as pd
import altair as alt

# Suppress the automatic deduplication warning from Altair
warnings.filterwarnings("ignore", message="Automatically deduplicated selection parameter")

def main():
    # Define file paths
    project_dir = "/home/user/project"
    csv_path = os.path.join(project_dir, "data/sales.csv")
    output_html_path = os.path.join(project_dir, "dashboard.html")

    print(f"Loading sales data from: {csv_path}")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Input file not found at {csv_path}")

    # Load data
    df = pd.read_csv(csv_path)
    
    # Convert date to datetime to ensure proper temporal parsing
    df['date'] = pd.to_datetime(df['date'])

    print("Building Altair chart...")

    # Create a single clickable point selection over the 'category' field,
    # bound to the color legend, and shared by both views.
    category_selection = alt.selection_point(
        name="category_select",
        fields=["category"],
        bind="legend"
    )

    # 1. Stacked Bar Chart: total monthly sales, with bars stacked and colored by category.
    # Uses a conditional encoding so the selected category is fully opaque while non-selected are dimmed.
    bar_chart = alt.Chart(df).mark_bar().encode(
        x=alt.X(
            "date:T",
            title="Month",
            axis=alt.Axis(format="%b %Y", labelAngle=-45, grid=True)
        ),
        y=alt.Y(
            "sum(sales):Q",
            title="Total Sales (Units)",
            stack="zero"
        ),
        color=alt.Color(
            "category:N",
            title="Product Category"
        ),
        opacity=alt.condition(
            category_selection,
            alt.value(1.0),
            alt.value(0.2)
        )
    ).properties(
        title=alt.TitleParams(
            text="Total Monthly Sales by Product Category",
            subtitle="Click on a category in the legend to focus/dim, double-click to reset",
            anchor="start",
            fontSize=14,
            subtitleFontSize=11
        ),
        width=700,
        height=250
    )

    # 2. Time-series Line Chart: monthly sales over time drawn as one line per category.
    # Uses a transform filter driven by the same selection so only the selected category is shown (or all if none).
    line_chart = alt.Chart(df).mark_line(point=True).encode(
        x=alt.X(
            "date:T",
            title="Month",
            axis=alt.Axis(format="%b %Y", labelAngle=-45, grid=True)
        ),
        y=alt.Y(
            "sales:Q",
            title="Monthly Sales (Units)"
        ),
        color=alt.Color(
            "category:N",
            title="Product Category"
        )
    ).transform_filter(
        category_selection
    ).properties(
        title=alt.TitleParams(
            text="Monthly Sales Trend (Filtered by Selection)",
            subtitle="Shows only the selected category's trend (or all categories if none selected)",
            anchor="start",
            fontSize=14,
            subtitleFontSize=11
        ),
        width=700,
        height=250
    )

    # Combine the two views into one vertically stacked chart
    dashboard = alt.vconcat(
        bar_chart,
        line_chart
    ).properties(
        title=alt.TitleParams(
            text="Interactive Legend Cross-Filter Sales Dashboard",
            subtitle=[
                "An offline-capable, self-contained sales analytics dashboard with linked views.",
                "Interactivity: Single click a category in the legend to filter both views. Double-click to reset."
            ],
            anchor="middle",
            fontSize=18,
            subtitleFontSize=12,
            offset=20
        )
    ).add_params(
        category_selection
    ).resolve_legend(
        color="shared"
    ).configure_view(
        stroke=None
    )

    print(f"Saving dashboard to self-contained HTML: {output_html_path}")
    # Save the chart as a single self-contained HTML file that renders without network access (inline=True)
    dashboard.save(output_html_path, inline=True)
    print("Dashboard generated successfully!")

if __name__ == "__main__":
    main()
