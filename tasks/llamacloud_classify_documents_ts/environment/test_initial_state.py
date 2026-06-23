import json
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SAMPLES_DIR = os.path.join(PROJECT_DIR, "samples")


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_samples_directory_exists():
    assert os.path.isdir(SAMPLES_DIR), f"Samples directory {SAMPLES_DIR} does not exist."


def test_invoice_sample_exists():
    path = os.path.join(SAMPLES_DIR, "invoice.txt")
    assert os.path.isfile(path), f"Sample file {path} does not exist."
    assert os.path.getsize(path) > 0, f"Sample file {path} is empty."


def test_receipt_sample_exists():
    path = os.path.join(SAMPLES_DIR, "receipt.txt")
    assert os.path.isfile(path), f"Sample file {path} does not exist."
    assert os.path.getsize(path) > 0, f"Sample file {path} is empty."


def test_contract_sample_exists():
    path = os.path.join(SAMPLES_DIR, "contract.txt")
    assert os.path.isfile(path), f"Sample file {path} does not exist."
    assert os.path.getsize(path) > 0, f"Sample file {path} is empty."


def test_llama_cloud_api_key_env_var_set():
    assert os.environ.get("LLAMA_CLOUD_API_KEY"), (
        "LLAMA_CLOUD_API_KEY environment variable is not set."
    )


def test_package_json_exists():
    path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(path), f"package.json not found at {path}."


def test_llama_cloud_ts_package_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules", "@llamaindex", "llama-cloud")
    assert os.path.isdir(node_modules), (
        f"@llamaindex/llama-cloud package not found at {node_modules}."
    )


def test_tsx_available():
    result = subprocess.run(
        ["npx", "--yes", "tsx", "--version"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"tsx is not runnable via npx in {PROJECT_DIR}: {result.stderr}"
    )


def test_classify_script_not_yet_present():
    path = os.path.join(PROJECT_DIR, "classify.ts")
    assert not os.path.exists(path), (
        f"classify.ts already exists at {path}; the executor is expected to create it."
    )


def test_output_log_not_yet_present():
    path = os.path.join(PROJECT_DIR, "output.log")
    assert not os.path.exists(path), (
        f"output.log already exists at {path}; the executor is expected to create it."
    )
