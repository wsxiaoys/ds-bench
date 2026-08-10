"""Configuration for the document-conversion gateway, sourced from environment
variables (with defaults) per the project specification.
"""
from __future__ import annotations

import os
from pathlib import Path

# Directory that contains this file's parent (the project root).
PROJECT_DIR = Path(__file__).resolve().parent.parent

# Only paths inside this directory may be referenced by /v1/jobs/path.
ASSETS_DIR = (PROJECT_DIR / "assets").resolve()

GATEWAY_PORT = int(os.environ.get("GATEWAY_PORT", "8077"))

GATEWAY_STATE_DIR = Path(
    os.environ.get("GATEWAY_STATE_DIR", str(PROJECT_DIR / "state"))
).resolve()

GATEWAY_JOB_TIMEOUT_SECONDS = float(
    os.environ.get("GATEWAY_JOB_TIMEOUT_SECONDS", "120")
)

# Fixed capacity model (see spec).
MAX_RUNNING = 2
MAX_QUEUE_WAITING = 4

# Bind address is fixed to loopback only.
BIND_HOST = "127.0.0.1"

# How long uvicorn waits for connections to drain on SIGTERM/SIGINT.
GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS = 5

STATES = ("queued", "running", "succeeded", "failed", "cancelled")
TERMINAL_STATES = ("succeeded", "failed", "cancelled")

RESULT_FORMATS = ("markdown", "json", "chunks")


def ensure_dirs() -> None:
    GATEWAY_STATE_DIR.mkdir(parents=True, exist_ok=True)
    (GATEWAY_STATE_DIR / "uploads").mkdir(parents=True, exist_ok=True)
    (GATEWAY_STATE_DIR / "results").mkdir(parents=True, exist_ok=True)
