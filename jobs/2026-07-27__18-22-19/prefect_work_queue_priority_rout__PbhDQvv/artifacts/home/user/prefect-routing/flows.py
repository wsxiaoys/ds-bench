"""Workflow definitions routed through the prioritized work queues.

Each flow is intentionally lightweight: it sleeps briefly so that the run is
observable in the Prefect UI and reaches the terminal ``Completed`` state, while
still exercising a real task so the worker actually executes work.
"""

import time

from prefect import flow, get_run_logger, task


@task
def do_work(seconds: int, label: str) -> str:
    """Pretend to do work, logging through Prefect's run logger."""
    logger = get_run_logger()
    logger.info("queue-class=%s starting work for %s seconds", label, seconds)
    time.sleep(seconds)
    logger.info("queue-class=%s finished work", label)
    return label


@flow(name="critical-flow")
def critical_flow(seconds: int = 2) -> str:
    """Flow routed through the ``critical`` work queue (priority 1, limit 1)."""
    return do_work(seconds, "critical")


@flow(name="standard-flow")
def standard_flow(seconds: int = 2) -> str:
    """Flow routed through the ``standard`` work queue (priority 5, limit 3)."""
    return do_work(seconds, "standard")


@flow(name="bulk-flow")
def bulk_flow(seconds: int = 2) -> str:
    """Flow routed through the ``bulk`` work queue (priority 10, limit 5)."""
    return do_work(seconds, "bulk")