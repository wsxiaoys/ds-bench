import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"
RESULTS_DIR = os.path.join(PROJECT_DIR, "results")
FLOW_FILE = os.path.join(PROJECT_DIR, "flow.py")

def test_flow_execution():
    """Verify that flow.py runs successfully."""
    assert os.path.isfile(FLOW_FILE), f"flow.py not found at {FLOW_FILE}"
    
    result = subprocess.run(
        ["python3", "flow.py"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"flow.py execution failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"

def test_result_files_exist():
    """Verify that results directory contains at least one file."""
    assert os.path.isdir(RESULTS_DIR), f"Results directory {RESULTS_DIR} does not exist."
    files = [f for f in os.listdir(RESULTS_DIR) if os.path.isfile(os.path.join(RESULTS_DIR, f))]
    assert len(files) > 0, f"No files found in {RESULTS_DIR}."

def test_obfuscated_secret_in_file():
    """Verify that the persisted result file contains the reversed secret 'nekot_terces_repus_ym'."""
    files = [os.path.join(RESULTS_DIR, f) for f in os.listdir(RESULTS_DIR) if os.path.isfile(os.path.join(RESULTS_DIR, f))]
    
    found_obfuscated = False
    for fpath in files:
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
                if "nekot_terces_repus_ym" in content:
                    found_obfuscated = True
                    break
        except Exception:
            continue
            
    assert found_obfuscated, "The obfuscated reversed secret 'nekot_terces_repus_ym' was not found in any result file."

def test_deserialize_restores_secret():
    """Verify that the custom serializer correctly restores the original secret."""
    verify_script = """
import sys
sys.path.insert(0, '/home/user/myproject')
try:
    from flow import ObfuscatedSerializer, SensitiveData
except ImportError as e:
    print(f"ImportError: {e}")
    sys.exit(1)

serializer = ObfuscatedSerializer()
data = SensitiveData(id=42, secret='my_super_secret_token')
try:
    blob = serializer.dumps(data)
except Exception as e:
    print(f"Error during dumps: {e}")
    sys.exit(1)

try:
    restored = serializer.loads(blob)
except Exception as e:
    print(f"Error during loads: {e}")
    sys.exit(1)

assert restored.id == 42, f"Expected id 42, got {restored.id}"
assert restored.secret == 'my_super_secret_token', f"Expected secret 'my_super_secret_token', got {restored.secret}"
print("success")
"""
    result = subprocess.run(
        ["python3", "-c", verify_script],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    assert result.returncode == 0, f"Deserialization test failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    assert "success" in result.stdout, "Deserialization did not complete successfully."
