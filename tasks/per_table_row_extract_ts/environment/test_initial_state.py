import os
import json
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
DATA_PDF = os.path.join(PROJECT_DIR, "data", "products.pdf")


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_binary_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_data_pdf_exists():
    assert os.path.isfile(DATA_PDF), (
        f"Source PDF {DATA_PDF} that the agent must extract from does not exist."
    )


def test_data_pdf_non_empty():
    assert os.path.getsize(DATA_PDF) > 0, f"Source PDF {DATA_PDF} is empty."


def test_data_pdf_is_pdf():
    with open(DATA_PDF, "rb") as f:
        header = f.read(5)
    assert header == b"%PDF-", f"Source file {DATA_PDF} is not a valid PDF (missing %PDF- header)."


def test_llama_cloud_api_key_set():
    assert os.environ.get("LLAMA_CLOUD_API_KEY"), (
        "LLAMA_CLOUD_API_KEY environment variable is not set in the task environment."
    )


def test_zealt_run_id_set():
    assert os.environ.get("ZEALT_RUN_ID"), (
        "ZEALT_RUN_ID environment variable is not set in the task environment."
    )


def test_package_json_exists():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json), f"Initial package.json at {package_json} does not exist."


def test_llama_cloud_ts_sdk_preinstalled():
    package_json = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json, "r", encoding="utf-8") as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}) or {})
    deps.update(pkg.get("devDependencies", {}) or {})
    assert "@llamaindex/llama-cloud" in deps, (
        "Expected '@llamaindex/llama-cloud' (the v2 TS SDK) to be preinstalled "
        "as a dependency in /home/user/myproject/package.json."
    )


def test_node_modules_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules", "@llamaindex", "llama-cloud")
    assert os.path.isdir(node_modules), (
        "Expected @llamaindex/llama-cloud to be installed under "
        "/home/user/myproject/node_modules/@llamaindex/llama-cloud."
    )


def test_tsx_runner_available():
    # tsx is invoked via npx tsx; verify the binary is installed in the project
    tsx_bin = os.path.join(PROJECT_DIR, "node_modules", ".bin", "tsx")
    assert os.path.isfile(tsx_bin) or os.access(tsx_bin, os.X_OK), (
        f"Expected tsx runner to be installed at {tsx_bin}."
    )


def test_output_artifacts_do_not_exist_yet():
    # The agent is expected to create these; they must not pre-exist.
    assert not os.path.exists(os.path.join(PROJECT_DIR, "output.json")), (
        "output.json should not exist before the task is executed."
    )
    assert not os.path.exists(os.path.join(PROJECT_DIR, "output.log")), (
        "output.log should not exist before the task is executed."
    )


def test_llama_cloud_api_key_is_valid():
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    # Sanity-call the API to make sure the key works against LlamaCloud.
    proc = subprocess.run(
        [
            "curl",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "-H",
            f"Authorization: Bearer {api_key}",
            "https://api.cloud.llamaindex.ai/api/v1/files?limit=1",
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, f"curl call failed: {proc.stderr}"
    assert proc.stdout.strip() == "200", (
        f"LLAMA_CLOUD_API_KEY does not authenticate against LlamaCloud; got HTTP {proc.stdout.strip()}."
    )
