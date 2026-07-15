import os
import pandas as pd
import altair as alt

# 1. Load the dataset
csv_path = '/home/user/altair_chart/data/marketing.csv'
df = pd.read_csv(csv_path)

# 2. Build the chart components
# Base encoding for the shared fields
base = alt.Chart(df).encode(
    x=alt.X('spend:Q', title='Advertising Spend ($)'),
    y=alt.Y('sales:Q', title='Sales (Units)'),
    color=alt.Color('region:N', title='Region')
)

# Layer 1: Scatter points
points = base.mark_point(
    filled=True,
    size=50,
    opacity=0.6
).properties(
    title='Advertising Spend vs. Sales by Region'
)

# Layer 2: LOESS smoothing line (solid)
loess = base.transform_loess(
    on='spend',
    loess='sales',
    groupby=['region']
).mark_line(
    size=3
)

# Layer 3: Linear regression trend line (dashed via strokeDash)
regression = base.transform_regression(
    on='spend',
    regression='sales',
    groupby=['region'],
    method='linear'
).mark_line(
    size=2,
    strokeDash=[6, 4]
)

# Layer 4: Text annotation of the regression R²
# Position the text label at spend = 70, and calculate the Y coordinate using the regression equation:
# sales = intercept + slope * spend
text = alt.Chart(df).transform_regression(
    on='spend',
    regression='sales',
    groupby=['region'],
    method='linear',
    params=True
).transform_calculate(
    spend="70",
    sales="datum.coef[0] + datum.coef[1] * 70",
    label="'R² = ' + format(datum.rSquared, '.2f')"
).mark_text(
    align='left',
    dx=8,
    dy=-8,
    fontSize=11,
    fontWeight='bold'
).encode(
    x='spend:Q',
    y='sales:Q',
    text='label:N',
    color='region:N'
)

# Combine the layers
chart = alt.layer(
    points,
    loess,
    regression,
    text
).properties(
    width=600,
    height=450
)

# 3. Ensure output directory exists and save the standalone HTML
output_dir = '/home/user/altair_chart/output'
os.makedirs(output_dir, exist_ok=True)
html_path = os.path.join(output_dir, 'chart.html')
chart.save(html_path)

# 4. Write the success message to the log file
log_path = '/home/user/altair_chart/run.log'
os.makedirs(os.path.dirname(log_path), exist_ok=True)
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(f"Chart saved: {html_path}\n")

print(f"Successfully generated chart and saved to {html_path}")
print(f"Log written to {log_path}")
