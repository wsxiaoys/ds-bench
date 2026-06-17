import subprocess
import os

def test_wasp_installed():
    try:
        result = subprocess.run(["wasp", "--version"], capture_output=True, text=True)
        assert result.returncode == 0
        assert "wasp version" in result.stdout.lower()
    except FileNotFoundError:
        assert False, "Wasp is not installed in the environment."

def test_project_dir_empty():
    project_dir = "/home/user/counter-app"
    if os.path.exists(project_dir):
        files = os.listdir(project_dir)
        # It's okay if it's empty or doesn't exist yet, but it shouldn't have a Wasp project.
        assert len(files) == 0, f"Project directory {project_dir} is not empty."
