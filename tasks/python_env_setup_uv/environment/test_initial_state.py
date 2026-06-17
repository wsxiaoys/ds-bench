import os
import subprocess
import shutil

def test_python3_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH."

def test_e2b_api_key_set():
    assert "E2B_API_KEY" in os.environ, "E2B_API_KEY environment variable is not set."

def test_e2b_sdk_installed():
    result = subprocess.run(["pip", "show", "e2b"], capture_output=True, text=True)
    assert result.returncode == 0, "e2b SDK is not installed."

def test_no_task_info_file():
    assert not os.path.exists("/home/user/e2b_task_info.json"), "/home/user/e2b_task_info.json should not exist initially."

def test_no_setup_script():
    assert not os.path.exists("/home/user/setup_env.py"), "/home/user/setup_env.py should not exist initially."
