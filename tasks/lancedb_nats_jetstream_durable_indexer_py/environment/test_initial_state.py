import importlib
import os
import shutil
import socket

import pytest

PROJECT_DIR = "/home/user/myproject"


def test_lancedb_importable():
    assert importlib.util.find_spec("lancedb") is not None, (
        "lancedb must be importable in the environment."
    )


def test_nats_client_importable():
    assert importlib.util.find_spec("nats") is not None, (
        "nats-py (import name 'nats') must be importable in the environment."
    )


def test_numpy_importable():
    assert importlib.util.find_spec("numpy") is not None, (
        "numpy must be importable in the environment."
    )


def test_pyarrow_importable():
    assert importlib.util.find_spec("pyarrow") is not None, (
        "pyarrow must be importable in the environment."
    )


def test_nats_server_binary_available():
    assert shutil.which("nats-server") is not None, (
        "nats-server binary must be available on PATH."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} must exist."
    )
