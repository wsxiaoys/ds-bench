import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/parse-task"
SAMPLE_PDF = os.path.join(PROJECT_DIR, "sample.pdf")


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_sample_pdf_exists():
    assert os.path.isfile(SAMPLE_PDF), f"Sample PDF {SAMPLE_PDF} does not exist."
    assert os.path.getsize(SAMPLE_PDF) > 0, f"Sample PDF {SAMPLE_PDF} is empty."


def test_sample_pdf_is_pdf():
    with open(SAMPLE_PDF, "rb") as f:
        header = f.read(5)
    assert header.startswith(b"%PDF-"), (
        f"Sample PDF {SAMPLE_PDF} does not start with the %PDF- magic bytes."
    )


def test_llama_cloud_api_key_env_set():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY environment variable is not set."
    assert api_key.startswith("llx-") or len(api_key) >= 10, (
        "LLAMA_CLOUD_API_KEY does not look like a valid LlamaCloud API key."
    )


def test_llama_cloud_ts_sdk_installable():
    # Confirm that the @llamaindex/llama-cloud package is reachable from the npm registry
    # (or already available in the global npm cache) so the executor can install it.
    result = subprocess.run(
        ["npm", "view", "@llamaindex/llama-cloud", "version"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, (
        "Failed to query @llamaindex/llama-cloud from npm. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert result.stdout.strip(), "npm view returned an empty version for @llamaindex/llama-cloud."
