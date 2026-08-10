"""Entry point: `python service/main.py` (run with the project root as cwd).

Binds 127.0.0.1:${GATEWAY_PORT} and guarantees a bounded shutdown on
SIGTERM/SIGINT via uvicorn's graceful-shutdown timeout.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make sibling modules importable regardless of how this script is invoked.
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn

import config
from app import app


def main() -> None:
    config.ensure_dirs()
    uvicorn_config = uvicorn.Config(
        app,
        host=config.BIND_HOST,
        port=config.GATEWAY_PORT,
        log_level="info",
        timeout_graceful_shutdown=config.GRACEFUL_SHUTDOWN_TIMEOUT_SECONDS,
    )
    server = uvicorn.Server(uvicorn_config)
    server.run()


if __name__ == "__main__":
    main()
