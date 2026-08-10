"""
Drive the top-level orders-pipeline workflow once against the local server.

Expected terminal states after one run:
  - charge-settlement-<run-id>: Failed
  - billing-rollup-<run-id>:    Failed
  - inventory-sync-<run-id>:    Completed
  - orders-pipeline-<run-id>:   Failed
"""

import os
import sys

os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"

from flows import orders_pipeline


def main():
    print("Starting top-level flow run: orders-pipeline")
    try:
        orders_pipeline()
    except Exception as e:
        # Expected: the top-level flow fails because the failing branch rolls up
        print(f"Top-level flow run failed (expected): {type(e).__name__}: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
