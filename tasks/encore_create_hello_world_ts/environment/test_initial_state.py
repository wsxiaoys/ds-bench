import os
import shutil

def test_encore_binary_available():
    assert shutil.which("encore") is not None, "encore binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir("/home/user/myproject"), "Project directory /home/user/myproject does not exist."
