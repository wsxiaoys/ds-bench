import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
INPUTS_DIR = os.path.join(PROJECT_DIR, "inputs")

EXPECTED_INPUT_PDFS = [
    "acme_invoice.pdf",
    "globex_invoice.pdf",
    "services_contract.pdf",
    "nda_contract.pdf",
]


def test_node_available():
    assert shutil.which("node") is not None, "Node.js binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_node_version_is_20_or_newer():
    result = subprocess.run(
        ["node", "--version"], capture_output=True, text=True, check=True
    )
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    assert major >= 20, f"Node.js >= 20 required, found v{version}."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_inputs_directory_exists():
    assert os.path.isdir(INPUTS_DIR), (
        f"Inputs directory {INPUTS_DIR} does not exist."
    )


def test_all_input_pdfs_present_and_nonempty():
    for name in EXPECTED_INPUT_PDFS:
        path = os.path.join(INPUTS_DIR, name)
        assert os.path.isfile(path), f"Expected input PDF {path} is missing."
        assert os.path.getsize(path) > 0, f"Input PDF {path} is empty."


def test_llama_cloud_api_key_set():
    key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    assert key, "LLAMA_CLOUD_API_KEY environment variable is not set."


def test_zealt_run_id_set():
    run_id = os.environ.get("ZEALT_RUN_ID", "")
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
