import altair as alt
import vega_datasets

# Robust patch for vega_datasets to support 'penguins'
if 'penguins' not in vega_datasets.core.Dataset._dataset_info:
    vega_datasets.core.Dataset._dataset_info['penguins'] = {
        'filename': 'penguins.json',
        'format': 'json',
        'is_local': False
    }
    vega_datasets.core.DataLoader._datasets = {
        name.replace('-', '_'): name for name in vega_datasets.core.Dataset.list_datasets()
    }

# Define a Dataset subclass for Penguins to ensure it resolves to a working CDN URL
class Penguins(vega_datasets.core.Dataset):
    name = 'penguins'
    def __init__(self, name='penguins'):
        super().__init__(name)
        self.url = 'https://cdn.jsdelivr.net/npm/vega-datasets/data/penguins.json'

from vega_datasets import data

def main():
    # Use vega_datasets.data.penguins.url as the data source
    source = data.penguins.url

    # Build the chart
    chart = alt.Chart(source).mark_point(
        filled=True,
        size=80
    ).encode(
        x=alt.X('Flipper Length (mm):Q', scale=alt.Scale(zero=False)),
        y=alt.Y('Body Mass (g):Q', scale=alt.Scale(zero=False)),
        color='Species:N',
        shape='Sex:N',
        tooltip=[
            'Species:N',
            'Island:N',
            'Flipper Length (mm):Q',
            'Body Mass (g):Q'
        ]
    ).interactive()

    # Save the chart as a single self-contained HTML file
    chart.save('/home/user/myproject/chart.html')
    print("Successfully saved chart to /home/user/myproject/chart.html")

if __name__ == '__main__':
    main()
