import os
import shutil

def test_prefect_binary_available():
    assert shutil.which("prefect") is not None, "prefect binary not found in PATH."

def test_project_directory_exists():
    assert os.path.isdir("/home/user/project"), "Project directory /home/user/project does not exist."
