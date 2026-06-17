import os
import shutil

PROJECT_DIR = "/home/user/project"
INVOICE_PDF = os.path.join(PROJECT_DIR, "invoice.pdf")


def test_node_binary_available():
    assert shutil.which("node") is not None, (
        "node binary not found in PATH; Node.js runtime is required to run the TypeScript script."
    )


def test_npm_binary_available():
    assert shutil.which("npm") is not None, (
        "npm binary not found in PATH; npm is required to install @llamaindex/llama-cloud."
    )


def test_npx_binary_available():
    assert shutil.which("npx") is not None, (
        "npx binary not found in PATH; npx is required to run the TypeScript script via tsx."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task starts."
    )


def test_invoice_pdf_present():
    assert os.path.isfile(INVOICE_PDF), (
        f"Expected sample invoice PDF at {INVOICE_PDF} to be pre-provisioned by the initial state."
    )
    # The file must be a non-trivial PDF.
    size = os.path.getsize(INVOICE_PDF)
    assert size > 500, (
        f"Invoice PDF at {INVOICE_PDF} is suspiciously small ({size} bytes); expected a real PDF document."
    )
    with open(INVOICE_PDF, "rb") as f:
        header = f.read(5)
    assert header.startswith(b"%PDF-"), (
        f"File at {INVOICE_PDF} does not look like a PDF (missing %PDF- header)."
    )


def test_llama_cloud_api_key_env_present():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    assert api_key, (
        "LLAMA_CLOUD_API_KEY environment variable must be set before the task runs."
    )


def test_legacy_llama_cloud_services_not_installed():
    legacy_dir = os.path.join(PROJECT_DIR, "node_modules", "llama-cloud-services")
    assert not os.path.exists(legacy_dir), (
        "Legacy llama-cloud-services package must NOT be pre-installed; the task targets the new v2 SDK."
    )
