import os
import pandas as pd
import numpy as np
import altair as alt

def generate_data():
    # Set random seed for reproducibility
    np.random.seed(42)

    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    hours = list(range(24))

    data = []
    for day in days:
        for hour in hours:
            # Determine base delay based on day and hour
            base_delay = 10.0  # default average delay
            
            # Day of week effect
            if day in ['Fri', 'Sun']:
                base_delay += 8.0
            elif day in ['Tue', 'Wed']:
                base_delay -= 4.0
                
            # Hour of day effect
            if 16 <= hour <= 20:
                base_delay += 15.0  # evening rush
            elif 7 <= hour <= 9:
                base_delay += 5.0   # morning rush
            elif 0 <= hour <= 5:
                base_delay -= 12.0  # late night / early morning (often early departures)
                
            # Generate 100 flights for this combination
            num_flights = 100
            # Normal distribution of delays around the base delay
            delays = np.random.normal(loc=base_delay, scale=12.0, size=num_flights)
            
            for d in delays:
                data.append({
                    'hour': hour,
                    'day': day,
                    'delay': round(d, 1)  # round to 1 decimal place
                })

    return pd.DataFrame(data)

def main():
    print("Generating synthetic flights dataset...")
    df = generate_data()
    print(f"Dataset generated with {len(df)} rows.")
    print(df.head())

    print("Building Altair chart...")
    
    # Create the base chart with binned hour and Day of Week
    base = alt.Chart(df).encode(
        x=alt.X('hour:Q')
            .bin(maxbins=24)  # Bin hours (0-23)
            .title('Departure Hour'),
        y=alt.Y('day:N')
            .sort(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
            .title('Day of Week')
    )

    # Heatmap layer using mark_rect
    heatmap = base.mark_rect().encode(
        color=alt.Color('mean(delay):Q')
            .scale(scheme='yelloworangered')  # Named color scheme
            .title('Mean Delay (min)')
    )

    # Text overlay layer using mark_text
    text = base.mark_text(baseline='middle').encode(
        text=alt.Text('mean(delay):Q', format='.1f'),
        color=alt.condition(
            alt.datum.mean_delay > 15,
            alt.value('white'),
            alt.value('black')
        )
    )

    # Combine the layers
    chart = (heatmap + text).properties(
        width=700,
        height=350,
        title=alt.TitleParams(
            text='Average Flight Departure Delay by Day and Hour',
            anchor='middle',
            fontSize=16
        )
    )

    # Save to self-contained HTML
    output_path = '/home/user/project/heatmap.html'
    print(f"Saving chart to {output_path}...")
    chart.save(output_path)
    print("Chart saved successfully!")

if __name__ == '__main__':
    main()
