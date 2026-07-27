#!/usr/bin/env python3
"""
Run the orders-etl flow for each of the three input sets:
  1. region=emea, batch=10
  2. region=apac, batch=25
  3. region=amer, batch=50
"""

from orders_etl import orders_etl

INPUT_SETS = [
    {"region": "emea", "batch": 10},
    {"region": "apac", "batch": 25},
    {"region": "amer", "batch": 50},
]

if __name__ == "__main__":
    for params in INPUT_SETS:
        print(f"Running flow with region={params['region']}, batch={params['batch']}...")
        result = orders_etl(region=params["region"], batch=params["batch"])
        print(f"  Result: {result}")
    print("\nAll three flow runs completed.")
