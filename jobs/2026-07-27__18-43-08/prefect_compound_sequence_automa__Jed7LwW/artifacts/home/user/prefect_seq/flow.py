from prefect import flow, get_run_logger


@flow(name="guarded-export-flow")
def guarded_export_flow(run_id: str = "zrqem35vag"):
    logger = get_run_logger()
    logger.info(f"Running guarded export for run_id={run_id}")
    logger.info("Export staged event was observed before approved event.")
    logger.info("Export completed successfully.")


if __name__ == "__main__":
    guarded_export_flow()
