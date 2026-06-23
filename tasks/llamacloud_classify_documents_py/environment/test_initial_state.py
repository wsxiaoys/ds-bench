import importlib
import os

import pytest

PROJECT_DIR = "/home/user/myproject"
FIXTURES_DIR = os.path.join(PROJECT_DIR, "fixtures")
INVOICE_PDF = os.path.join(FIXTURES_DIR, "invoice_sample.pdf")
CONTRACT_PDF = os.path.join(FIXTURES_DIR, "contract_sample.pdf")


def test_llama_cloud_sdk_importable():
    """The target SDK (`llama_cloud`, v2.x) must be installed and importable."""
    module = importlib.import_module("llama_cloud")
    assert module is not None, "llama_cloud SDK should be importable."


def test_llama_cloud_api_key_env_present():
    """The LlamaCloud Classifier requires LLAMA_CLOUD_API_KEY in the environment."""
    api_key = os.environ.get("LLAMA_CLOUD_API_KEY")
    assert api_key, "LLAMA_CLOUD_API_KEY environment variable must be set in the initial environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_fixtures_dir_exists():
    assert os.path.isdir(FIXTURES_DIR), f"Fixtures directory {FIXTURES_DIR} does not exist."


def test_invoice_fixture_exists():
    assert os.path.isfile(INVOICE_PDF), f"Invoice fixture {INVOICE_PDF} does not exist."
    assert os.path.getsize(INVOICE_PDF) > 0, f"Invoice fixture {INVOICE_PDF} is empty."


def test_contract_fixture_exists():
    assert os.path.isfile(CONTRACT_PDF), f"Contract fixture {CONTRACT_PDF} does not exist."
    assert os.path.getsize(CONTRACT_PDF) > 0, f"Contract fixture {CONTRACT_PDF} is empty."


def test_invoice_fixture_is_pdf():
    with open(INVOICE_PDF, "rb") as f:
        head = f.read(5)
    assert head.startswith(b"%PDF-"), f"Invoice fixture {INVOICE_PDF} is not a valid PDF."


def test_contract_fixture_is_pdf():
    with open(CONTRACT_PDF, "rb") as f:
        head = f.read(5)
    assert head.startswith(b"%PDF-"), f"Contract fixture {CONTRACT_PDF} is not a valid PDF."


def test_classify_script_not_yet_created():
    """The executor is responsible for creating classify.py; it must not exist yet."""
    script_path = os.path.join(PROJECT_DIR, "classify.py")
    assert not os.path.exists(script_path), (
        f"classify.py should not yet exist in {PROJECT_DIR}; the executor will create it."
    )
