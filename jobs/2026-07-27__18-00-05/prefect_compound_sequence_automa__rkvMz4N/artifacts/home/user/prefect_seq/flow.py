"""
A simple flow that will be triggered by the seq-guard automation.
"""
from prefect import flow


@flow(name="guarded-export-flow")
def guarded_export_flow() -> str:
    print("Guarded export flow has been triggered!")
    return "export-complete"
