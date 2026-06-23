import json
import os
import re
import subprocess
from pathlib import Path

import pytest

PROJECT_DIR = "/home/user/myproject"
SCRIPT_NAME = "classify.py"
SCRIPT_PATH = os.path.join(PROJECT_DIR, SCRIPT_NAME)

INVOICE_REL = "fixtures/invoice_sample.pdf"
CONTRACT_REL = "fixtures/contract_sample.pdf"
INVOICE_ABS = os.path.join(PROJECT_DIR, INVOICE_REL)
CONTRACT_ABS = os.path.join(PROJECT_DIR, CONTRACT_REL)


def _extract_json_object(stdout: str) -> dict:
    """Find the JSON object in script stdout. Tolerate extra log lines."""
    # 1) Whole stdout is a single JSON object
    try:
        obj = json.loads(stdout.strip())
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # 2) Last line that parses as a JSON object
    for line in reversed([ln for ln in stdout.splitlines() if ln.strip()]):
        try:
            obj = json.loads(line.strip())
            if isinstance(obj, dict):
                return obj
        except Exception:
            continue

    # 3) Regex pull of the first {...} block and try to parse it.
    match = re.search(r"\{.*\}", stdout, re.DOTALL)
    if match:
        try:
            obj = json.loads(match.group(0))
            if isinstance(obj, dict):
                return obj
        except Exception:
            pass

    raise AssertionError(f"Could not find a JSON object in stdout:\n{stdout!r}")


def _run_classify(file_arg: str, timeout: int = 600) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    return subprocess.run(
        ["python3", SCRIPT_NAME, file_arg],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=env,
        timeout=timeout,
    )


def test_classify_script_exists():
    assert os.path.isfile(SCRIPT_PATH), (
        f"Expected the executor to create classify.py at {SCRIPT_PATH}."
    )


def test_classify_script_no_mocking():
    """The script must call the real LlamaCloud SDK, not mock or stub it."""
    with open(SCRIPT_PATH, "r", encoding="utf-8") as f:
        source = f.read()
    forbidden = re.compile(r"\b(mock|monkeypatch|stub|fake)\b", re.IGNORECASE)
    matches = forbidden.findall(source)
    assert not matches, (
        f"classify.py must not mock the target system, but found tokens: {matches}"
    )


def test_classify_script_uses_modern_sdk():
    with open(SCRIPT_PATH, "r", encoding="utf-8") as f:
        source = f.read()
    assert re.search(r"^\s*(from\s+llama_cloud(\s|\.)|import\s+llama_cloud(\s|$))", source, re.MULTILINE), (
        "classify.py must import from the modern `llama_cloud` Python SDK (v2.x)."
    )
    assert "llama_cloud_services" not in source, (
        "classify.py must not use the legacy `llama_cloud_services` wrapper."
    )


def test_classify_invoice_returns_invoice_type():
    proc = _run_classify(INVOICE_REL)
    assert proc.returncode == 0, (
        f"classify.py exited with code {proc.returncode}.\nstdout: {proc.stdout}\nstderr: {proc.stderr}"
    )
    payload = _extract_json_object(proc.stdout)

    assert "type" in payload, f"Expected 'type' field in output JSON, got: {payload}"
    assert "confidence" in payload, f"Expected 'confidence' field in output JSON, got: {payload}"
    assert "file" in payload, f"Expected 'file' field in output JSON, got: {payload}"

    assert payload["type"] == "invoice", (
        f"Expected the invoice fixture to be classified as 'invoice', got: {payload['type']!r}"
    )

    confidence = payload["confidence"]
    assert isinstance(confidence, (int, float)), (
        f"Expected confidence to be numeric, got: {confidence!r}"
    )
    assert 0.0 <= float(confidence) <= 1.0, (
        f"Expected confidence in [0, 1], got: {confidence!r}"
    )

    expected_path = str(Path(INVOICE_ABS).resolve())
    assert payload["file"] == expected_path, (
        f"Expected 'file' to be the absolute path {expected_path}, got: {payload['file']!r}"
    )


def test_classify_contract_returns_contract_type():
    proc = _run_classify(CONTRACT_REL)
    assert proc.returncode == 0, (
        f"classify.py exited with code {proc.returncode}.\nstdout: {proc.stdout}\nstderr: {proc.stderr}"
    )
    payload = _extract_json_object(proc.stdout)

    assert payload.get("type") == "contract", (
        f"Expected the contract fixture to be classified as 'contract', got: {payload.get('type')!r}"
    )

    confidence = payload.get("confidence")
    assert isinstance(confidence, (int, float)), (
        f"Expected confidence to be numeric, got: {confidence!r}"
    )
    assert 0.0 <= float(confidence) <= 1.0, (
        f"Expected confidence in [0, 1], got: {confidence!r}"
    )

    expected_path = str(Path(CONTRACT_ABS).resolve())
    assert payload.get("file") == expected_path, (
        f"Expected 'file' to be the absolute path {expected_path}, got: {payload.get('file')!r}"
    )


def test_classify_missing_file_returns_nonzero():
    bogus_path = os.path.join(PROJECT_DIR, "fixtures", "does_not_exist.pdf")
    proc = subprocess.run(
        ["python3", SCRIPT_NAME, bogus_path],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=120,
    )
    assert proc.returncode != 0, (
        "Expected classify.py to exit non-zero when the input file is missing; "
        f"got returncode=0.\nstdout: {proc.stdout}\nstderr: {proc.stderr}"
    )
