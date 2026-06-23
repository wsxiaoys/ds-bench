import os
import shutil
import pytest

def test_encore_binary_available():
    assert shutil.which("encore") is not None, "encore binary not found in PATH."
