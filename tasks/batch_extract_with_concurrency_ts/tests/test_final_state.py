import json
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
RESULTS_PATH = os.path.join(PROJECT_DIR, "results.json")
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")

EXPECTED_INVOICES = {
    "acme.pdf": {
        "vendor_substr": "acme",
        "invoice_substr": "INV-1001",
        "total": 1234.56,
        "currency": "USD",
    },
    "globex.pdf": {
        "vendor_substr": "globex",
        "invoice_substr": "INV-2002",
        "total": 9876.5,
        "currency": "EUR",
    },
    "initech.pdf": {
        "vendor_substr": "initech",
        "invoice_substr": "INV-3003",
        "total": 42.0,
        "currency": "GBP",
    },
}


def _find_source_files():
    """Find candidate TypeScript entrypoints written by the executor."""
    candidates = []
    for entry in os.listdir(PROJECT_DIR):
        full = os.path.join(PROJECT_DIR, entry)
        if (
            os.path.isfile(full)
            and (entry.endswith(".ts") or entry.endswith(".mts"))
            and not entry.endswith(".d.ts")
        ):
            candidates.append(full)
    return candidates


@pytest.fixture(scope="module")
def source_text():
    files = _find_source_files()
    assert files, (
        f"No TypeScript source file (.ts) found in {PROJECT_DIR}. "
        "Expected the executor to write a single TS entrypoint such as run.ts."
    )
    combined = ""
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            combined += f.read() + "\n"
    return combined


@pytest.fixture(scope="module")
def results_data():
    assert os.path.isfile(RESULTS_PATH), (
        f"Expected results artifact at {RESULTS_PATH} but it does not exist."
    )
    with open(RESULTS_PATH, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            pytest.fail(f"{RESULTS_PATH} is not valid JSON: {e}")
    assert isinstance(data, list), (
        f"results.json must be a JSON array, got {type(data).__name__}."
    )
    return data


@pytest.fixture(scope="module")
def log_text():
    assert os.path.isfile(LOG_PATH), (
        f"Expected log file at {LOG_PATH} but it does not exist."
    )
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        return f.read()


def test_source_imports_llama_cloud_sdk(source_text):
    assert "@llamaindex/llama-cloud" in source_text, (
        "TypeScript source must import from '@llamaindex/llama-cloud' "
        "(the official LlamaCloud v2 TS SDK)."
    )


def test_source_imports_zod(source_text):
    assert re.search(r"from\s+['\"]zod['\"]", source_text), (
        "TypeScript source must import from 'zod' to define the extraction schema."
    )


def test_source_uses_cost_effective_tier(source_text):
    assert "cost_effective" in source_text, (
        "TypeScript source must request the 'cost_effective' tier from LlamaCloud Extract."
    )


def test_log_contains_summary_line(log_text):
    match = re.search(
        r"^SUMMARY total=(\d+) success=(\d+) failed=(\d+)$",
        log_text,
        flags=re.MULTILINE,
    )
    assert match, (
        f"output.log must contain a final summary line matching "
        f"'^SUMMARY total=\\d+ success=\\d+ failed=\\d+$'. Got log:\n{log_text}"
    )


def _parse_summary(log_text):
    match = re.search(
        r"^SUMMARY total=(\d+) success=(\d+) failed=(\d+)$",
        log_text,
        flags=re.MULTILINE,
    )
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def test_summary_counts_are_consistent(log_text, results_data):
    parsed = _parse_summary(log_text)
    assert parsed is not None, "Summary line missing from output.log."
    total, success, failed = parsed
    assert total == 3, (
        f"Summary total must be 3 (three seeded invoices), got total={total}."
    )
    assert success + failed == total, (
        f"Summary inconsistent: success({success}) + failed({failed}) != total({total})."
    )
    assert success >= 2, (
        f"At least 2 invoices must be successfully extracted; got success={success}."
    )
    assert len(results_data) == 3, (
        f"results.json must contain exactly 3 entries, got {len(results_data)}."
    )


def test_results_json_per_file_shape(results_data):
    file_names = set()
    for entry in results_data:
        assert isinstance(entry, dict), (
            f"Each results.json entry must be a JSON object, got {type(entry).__name__}: {entry!r}"
        )
        assert "file" in entry and isinstance(entry["file"], str), (
            f"Each entry must have a string 'file' field. Got: {entry!r}"
        )
        assert "status" in entry and entry["status"] in ("success", "error"), (
            f"Each entry must have a 'status' field with value 'success' or 'error'. Got: {entry!r}"
        )
        file_names.add(os.path.basename(entry["file"]).lower())

        if entry["status"] == "success":
            assert "data" in entry and isinstance(entry["data"], dict), (
                f"Successful entry must have a 'data' object. Got: {entry!r}"
            )
            data = entry["data"]
            for required_key, required_type in [
                ("vendor_name", str),
                ("invoice_number", str),
                ("total_amount", (int, float)),
                ("currency", str),
            ]:
                assert required_key in data, (
                    f"Successful entry for {entry['file']} missing required field "
                    f"'{required_key}' in data. Got: {data!r}"
                )
                assert isinstance(data[required_key], required_type), (
                    f"Field '{required_key}' in entry for {entry['file']} must be of type "
                    f"{required_type}, got {type(data[required_key]).__name__}."
                )
        else:
            assert "error" in entry and isinstance(entry["error"], str), (
                f"Failed entry must have a string 'error' field. Got: {entry!r}"
            )

    for expected_name in EXPECTED_INVOICES:
        assert expected_name.lower() in file_names, (
            f"results.json missing an entry for seeded invoice '{expected_name}'. "
            f"Found files: {sorted(file_names)}"
        )


def test_extracted_values_match_seeded_invoices(results_data):
    """Real LlamaCloud Extract must have produced ground-truth fields for at least 2 of 3 invoices."""
    matched = 0
    by_name = {}
    for entry in results_data:
        if entry.get("status") != "success":
            continue
        name = os.path.basename(entry["file"]).lower()
        by_name[name] = entry["data"]

    for name, expected in EXPECTED_INVOICES.items():
        data = by_name.get(name.lower())
        if not data:
            continue
        vendor = str(data.get("vendor_name", "")).lower()
        invoice_num = str(data.get("invoice_number", ""))
        try:
            total = float(data.get("total_amount"))
        except (TypeError, ValueError):
            continue
        currency = str(data.get("currency", "")).upper()

        vendor_ok = expected["vendor_substr"].lower() in vendor
        invoice_ok = expected["invoice_substr"] in invoice_num
        total_ok = abs(total - expected["total"]) <= 0.05
        currency_ok = expected["currency"] == currency

        if vendor_ok and invoice_ok and total_ok and currency_ok:
            matched += 1

    assert matched >= 2, (
        f"Real-extraction check: expected at least 2 of 3 seeded invoices to match "
        f"ground-truth content (vendor substring, invoice number substring, total "
        f"within 0.05, exact currency). Matched={matched}. results.json="
        f"{json.dumps(by_name, indent=2)[:2000]}"
    )


def test_log_records_each_processed_file(log_text):
    for name in EXPECTED_INVOICES:
        assert re.search(
            rf"PROCESSED\s+{re.escape(name)}:", log_text
        ), (
            f"Expected log line 'PROCESSED {name}: <status>' in {LOG_PATH}. "
            f"Got log:\n{log_text[:2000]}"
        )
