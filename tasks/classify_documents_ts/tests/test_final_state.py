import os
import re

PROJECT_DIR = "/home/user/myproject"
SCRIPT_PATH = os.path.join(PROJECT_DIR, "classify.ts")
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")

EXPECTED_FILES = {
    "invoice.txt": "invoice",
    "receipt.txt": "receipt",
    "contract.txt": "contract",
}

LINE_RE = re.compile(
    r"^Classified:\s+(?P<basename>[^\s|]+)\s+\|\s+Type:\s+(?P<type>[^|]+?)\s+\|\s+Confidence:\s+(?P<confidence>[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*$"
)


def _read_log_lines():
    assert os.path.isfile(LOG_PATH), f"Log file not found at {LOG_PATH}."
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        lines = [ln.rstrip("\n").rstrip("\r") for ln in f.readlines()]
    return [ln for ln in lines if ln.strip()]


def test_classify_script_exists():
    assert os.path.isfile(SCRIPT_PATH), f"Expected TypeScript script at {SCRIPT_PATH}."


def test_classify_script_uses_llama_cloud_package():
    with open(SCRIPT_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert "@llamaindex/llama-cloud" in content, (
        f"Expected {SCRIPT_PATH} to import from '@llamaindex/llama-cloud'."
    )


def test_output_log_exists():
    assert os.path.isfile(LOG_PATH), f"Expected log file at {LOG_PATH}."


def test_log_first_line_is_run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable is not set in the verifier."
    lines = _read_log_lines()
    assert len(lines) >= 1, f"Log file {LOG_PATH} is empty."
    first = lines[0].strip()
    expected = f"Run ID: {run_id}"
    assert first == expected, (
        f"First non-empty log line must be {expected!r}, but got {first!r}."
    )


def test_log_has_three_classification_lines():
    lines = _read_log_lines()
    classification_lines = [ln for ln in lines[1:] if ln.startswith("Classified:")]
    assert len(classification_lines) == 3, (
        f"Expected exactly 3 classification lines in {LOG_PATH}, found {len(classification_lines)}: {classification_lines}"
    )


def test_log_classification_lines_have_correct_format():
    lines = _read_log_lines()
    classification_lines = [ln for ln in lines[1:] if ln.startswith("Classified:")]
    for ln in classification_lines:
        m = LINE_RE.match(ln)
        assert m is not None, (
            f"Classification line does not match required format "
            f"'Classified: <basename> | Type: <type> | Confidence: <number>': {ln!r}"
        )
        basename = m.group("basename")
        assert basename in EXPECTED_FILES, (
            f"Unexpected basename {basename!r} in log line {ln!r}; "
            f"expected one of {sorted(EXPECTED_FILES)}."
        )
        confidence = float(m.group("confidence"))
        assert 0.0 <= confidence <= 1.0, (
            f"Confidence value {confidence} in line {ln!r} must be between 0.0 and 1.0."
        )


def test_log_covers_all_expected_files():
    lines = _read_log_lines()
    classification_lines = [ln for ln in lines[1:] if ln.startswith("Classified:")]
    seen = set()
    for ln in classification_lines:
        m = LINE_RE.match(ln)
        if m:
            seen.add(m.group("basename"))
    assert seen == set(EXPECTED_FILES.keys()), (
        f"Log must have a classification line for each of {sorted(EXPECTED_FILES)}, "
        f"but found {sorted(seen)}."
    )


def test_invoice_predicted_as_invoice():
    lines = _read_log_lines()
    for ln in lines[1:]:
        m = LINE_RE.match(ln)
        if m and m.group("basename") == "invoice.txt":
            predicted = m.group("type").strip()
            assert predicted == "invoice", (
                f"Expected invoice.txt to be classified as 'invoice', got {predicted!r} in line {ln!r}."
            )
            return
    raise AssertionError("No classification line found for invoice.txt.")


def test_receipt_predicted_as_receipt():
    lines = _read_log_lines()
    for ln in lines[1:]:
        m = LINE_RE.match(ln)
        if m and m.group("basename") == "receipt.txt":
            predicted = m.group("type").strip()
            assert predicted == "receipt", (
                f"Expected receipt.txt to be classified as 'receipt', got {predicted!r} in line {ln!r}."
            )
            return
    raise AssertionError("No classification line found for receipt.txt.")


def test_contract_predicted_as_contract():
    lines = _read_log_lines()
    for ln in lines[1:]:
        m = LINE_RE.match(ln)
        if m and m.group("basename") == "contract.txt":
            predicted = m.group("type").strip()
            assert predicted == "contract", (
                f"Expected contract.txt to be classified as 'contract', got {predicted!r} in line {ln!r}."
            )
            return
    raise AssertionError("No classification line found for contract.txt.")
