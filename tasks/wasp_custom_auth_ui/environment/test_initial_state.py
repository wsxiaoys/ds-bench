import subprocess
import os

def test_wasp_installed():
    try:
        subprocess.run(["wasp", "--version"], capture_output=True, text=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        assert False, "Wasp is not installed."

def test_project_dir_empty():
    project_dir = "/home/user/custom-auth-ui"
    if os.path.exists(project_dir):
        assert len(os.listdir(project_dir)) == 0
