import os
import shutil
import pytest

def test_encore_binary_available():
    assert shutil.which("encore") is not None, "encore binary not found in PATH."

def test_express_app_exists():
    assert os.path.isdir("/home/user/express-app"), "/home/user/express-app directory does not exist."
    assert os.path.isfile("/home/user/express-app/index.js"), "/home/user/express-app/index.js does not exist."
