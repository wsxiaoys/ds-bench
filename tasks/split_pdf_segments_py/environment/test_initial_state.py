import json
import os
import shutil

PROJECT_DIR = "/home/user/myproject"
PDF_PATH = os.path.join(PROJECT_DIR, "data", "turing+imagenet+attention.pdf")
CONFIG_PATH = os.path.join(PROJECT_DIR, "data", "categories.json")


def test_python_available():
    assert shutil.which("python3") is not None, "python3 is not available in PATH."


def test_llama_cloud_sdk_importable():
    # The llama-cloud Python SDK must be installed in the environment.
    import importlib

    module = importlib.import_module("llama_cloud")
    assert hasattr(module, "LlamaCloud"), (
        "llama_cloud module is importable but does not expose 'LlamaCloud'."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_sample_pdf_present():
    assert os.path.isfile(PDF_PATH), (
        f"Sample PDF {PDF_PATH} must be pre-baked into the environment."
    )
    # Sanity-check size > 0 to ensure the bundled fixture downloaded correctly.
    assert os.path.getsize(PDF_PATH) > 0, f"Sample PDF {PDF_PATH} is empty."


def test_categories_config_present_and_well_formed():
    assert os.path.isfile(CONFIG_PATH), (
        f"Categories config {CONFIG_PATH} must be pre-baked into the environment."
    )
    with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    assert isinstance(data, dict) and "categories" in data, (
        "categories.json must contain a top-level 'categories' key."
    )
    categories = data["categories"]
    assert isinstance(categories, list) and len(categories) >= 2, (
        "categories.json must contain at least two category entries."
    )
    names = {entry.get("name") for entry in categories if isinstance(entry, dict)}
    assert {"essay", "research_paper"}.issubset(names), (
        "categories.json must include both 'essay' and 'research_paper' entries."
    )


def test_llama_cloud_api_key_env_present():
    assert os.environ.get("LLAMA_CLOUD_API_KEY"), (
        "LLAMA_CLOUD_API_KEY environment variable must be set for the task to run."
    )
