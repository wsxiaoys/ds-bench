import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
INVOICES_DIR = os.path.join(PROJECT_DIR, "invoices")
EXPECTED_INVOICES = ["acme.pdf", "globex.pdf", "initech.pdf"]


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_node_version_modern():
    result = subprocess.run(
        ["node", "--version"], capture_output=True, text=True, check=True
    )
    raw = result.stdout.strip().lstrip("v")
    major = int(raw.split(".")[0])
    assert major >= 20, (
        f"@llamaindex/llama-cloud requires Node >= 20 but found node {raw}."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_invoices_dir_exists():
    assert os.path.isdir(INVOICES_DIR), (
        f"Invoices directory {INVOICES_DIR} does not exist."
    )


def test_seeded_invoice_pdfs_present():
    for name in EXPECTED_INVOICES:
        pdf_path = os.path.join(INVOICES_DIR, name)
        assert os.path.isfile(pdf_path), (
            f"Expected seeded invoice PDF {pdf_path} is missing."
        )
        size = os.path.getsize(pdf_path)
        assert size > 200, (
            f"Seeded invoice PDF {pdf_path} is suspiciously small ({size} bytes)."
        )


def test_llama_cloud_api_key_env_var_set():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, (
        "LLAMA_CLOUD_API_KEY environment variable is not set in the task environment."
    )


def test_no_pre_existing_results_json():
    results_path = os.path.join(PROJECT_DIR, "results.json")
    assert not os.path.exists(results_path), (
        f"results.json must NOT exist before the task runs; found pre-existing file at {results_path}."
    )


def test_no_pre_existing_output_log():
    log_path = os.path.join(PROJECT_DIR, "output.log")
    assert not os.path.exists(log_path), (
        f"output.log must NOT exist before the task runs; found pre-existing file at {log_path}."
    )
