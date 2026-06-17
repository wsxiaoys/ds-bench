import os
import subprocess

def test_environment_setup():
    assert os.path.exists("/home/user"), "User directory should exist"
    assert os.getcwd() == "/home/user", "Working directory should be /home/user"
    
def test_e2b_installed():
    result = subprocess.run(["pip3", "show", "e2b"], capture_output=True, text=True)
    assert result.returncode == 0, "e2b package should be installed"

def test_files_do_not_exist_yet():
    assert not os.path.exists("/home/user/manage_sandbox.py"), "manage_sandbox.py should not exist yet"
    assert not os.path.exists("/home/user/sandbox_id.txt"), "sandbox_id.txt should not exist yet"
    assert not os.path.exists("/home/user/retrieved_metadata.json"), "retrieved_metadata.json should not exist yet"
