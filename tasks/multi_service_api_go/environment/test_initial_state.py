import shutil
import pytest

def test_encore_binary_available():
    assert shutil.which("encore") is not None, "encore binary not found in PATH."

def test_go_binary_available():
    assert shutil.which("go") is not None, "go binary not found in PATH."
