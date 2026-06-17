import os
import shutil

def test_python3_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."

def test_work_directory_exists():
    assert os.path.isdir("/home/user"), "Working directory /home/user does not exist."
