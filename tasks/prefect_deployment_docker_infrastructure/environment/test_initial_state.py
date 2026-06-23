import shutil
import pytest

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."
