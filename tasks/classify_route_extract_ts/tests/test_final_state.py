import json
import math
import os
import re

import pytest

PROJECT_DIR = "/home/user/myproject"
INPUTS_DIR = os.path.join(PROJECT_DIR, "inputs")
OUTPUTS_DIR = os.path.join(PROJECT_DIR, "outputs")
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")
RESULTS_JSON = os.path.join(OUTPUTS_DIR, "results.json")

EXPECTED_BASENAMES = [
    "acme_invoice.pdf",
    "globex_invoice.pdf",
    "services_contract.pdf",
    "nda_contract.pdf",
]

EXPECTED_CATEGORY = {
    "acme_invoice.pdf": "invoice",
    "globex_invoice.pdf": "invoice",
    "services_contract.pdf": "contract",
    "nda_contract.pdf": "contract",
}

EXPECTED_FIELDS = {
    "invoice": 4,
    "contract": 3,
}

LOG_LINE_RE = re.compile(
    r"^Routed: (?P<basename>[A-Za-z0-9_.-]+\.pdf) \| "
    r"category: (?P<cat>invoice|contract) \| "
    r"confidence: (?P<conf>[0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?) \| "
    r"fields: (?P<fields>3|4)$"
)


@pytest.fixture(scope="session")
def run_id():
    rid = os.environ.get("ZEALT_RUN_ID", "")
    assert rid, "ZEALT_RUN_ID is not set in the verifier environment."
    return rid


@pytest.fixture(scope="session")
def api_key():
    key = os.environ.get("LLAMA_CLOUD_API_KEY", "")
    assert key, "LLAMA_CLOUD_API_KEY is not set in the verifier environment."
    return key


@pytest.fixture(scope="session")
def llama_client(api_key):
    from llama_cloud import LlamaCloud

    return LlamaCloud(api_key=api_key)


@pytest.fixture(scope="session")
def log_lines():
    assert os.path.isfile(LOG_FILE), f"Expected log file {LOG_FILE} to exist."
    with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return lines


@pytest.fixture(scope="session")
def parsed_log(log_lines):
    """Parse the 4 routed log lines into a dict keyed by basename."""
    assert len(log_lines) == 4, (
        f"Expected exactly 4 non-empty lines in {LOG_FILE}, got {len(log_lines)}: "
        f"{log_lines!r}"
    )
    parsed = {}
    for ln in log_lines:
        m = LOG_LINE_RE.match(ln)
        assert m, f"Log line does not match required format: {ln!r}"
        basename = m.group("basename")
        cat = m.group("cat")
        conf = float(m.group("conf"))
        fields = int(m.group("fields"))
        assert basename not in parsed, (
            f"Duplicate basename {basename!r} in {LOG_FILE}"
        )
        parsed[basename] = {
            "category": cat,
            "confidence": conf,
            "fields": fields,
        }
    return parsed


@pytest.fixture(scope="session")
def results_payload():
    assert os.path.isfile(RESULTS_JSON), (
        f"Expected results JSON {RESULTS_JSON} to exist."
    )
    with open(RESULTS_JSON, "r", encoding="utf-8", errors="replace") as fh:
        return json.load(fh)


def test_input_pdfs_present():
    for name in EXPECTED_BASENAMES:
        path = os.path.join(INPUTS_DIR, name)
        assert os.path.isfile(path), f"Input PDF {path} is missing."
        assert os.path.getsize(path) > 0, f"Input PDF {path} is empty."


def test_outputs_directory_exists():
    assert os.path.isdir(OUTPUTS_DIR), (
        f"Expected outputs directory {OUTPUTS_DIR} to exist."
    )


def test_log_basenames_match_expected(parsed_log):
    assert set(parsed_log.keys()) == set(EXPECTED_BASENAMES), (
        f"Log file basenames must equal {sorted(EXPECTED_BASENAMES)}; "
        f"got {sorted(parsed_log.keys())}."
    )


def test_log_categories_match_expected(parsed_log):
    for basename, expected_cat in EXPECTED_CATEGORY.items():
        actual = parsed_log[basename]["category"]
        assert actual == expected_cat, (
            f"Log line for {basename!r} expected category={expected_cat!r}, "
            f"got {actual!r}."
        )


def test_log_field_counts_match_category(parsed_log):
    for basename, entry in parsed_log.items():
        expected_fields = EXPECTED_FIELDS[entry["category"]]
        assert entry["fields"] == expected_fields, (
            f"Log line for {basename!r} (category {entry['category']!r}) "
            f"expected fields={expected_fields}, got {entry['fields']}."
        )


def test_log_confidences_are_finite_floats(parsed_log):
    for basename, entry in parsed_log.items():
        conf = entry["confidence"]
        assert isinstance(conf, float) and math.isfinite(conf), (
            f"Confidence for {basename!r} must be a finite float, got {conf!r}."
        )


def test_log_category_counts_are_balanced(parsed_log):
    cat_counts = {"invoice": 0, "contract": 0}
    for entry in parsed_log.values():
        cat_counts[entry["category"]] += 1
    assert cat_counts == {"invoice": 2, "contract": 2}, (
        f"Expected exactly 2 invoices and 2 contracts in the log, got {cat_counts}."
    )


def test_results_json_top_level_keys(results_payload):
    assert isinstance(results_payload, dict), (
        f"{RESULTS_JSON} must be a JSON object."
    )
    assert set(results_payload.keys()) == set(EXPECTED_BASENAMES), (
        f"results.json keys must equal {sorted(EXPECTED_BASENAMES)}; "
        f"got {sorted(results_payload.keys())}."
    )


def test_results_json_entry_shape(results_payload):
    required_keys = {"category", "confidence", "file_id", "data"}
    for basename, entry in results_payload.items():
        assert isinstance(entry, dict), (
            f"results.json[{basename!r}] must be an object, got {type(entry).__name__}."
        )
        assert set(entry.keys()) == required_keys, (
            f"results.json[{basename!r}] must have exactly keys {sorted(required_keys)}; "
            f"got {sorted(entry.keys())}."
        )
        assert isinstance(entry["category"], str) and entry["category"] in (
            "invoice",
            "contract",
        ), (
            f"results.json[{basename!r}].category must be 'invoice' or 'contract', "
            f"got {entry['category']!r}."
        )
        assert isinstance(entry["confidence"], (int, float)) and not isinstance(
            entry["confidence"], bool
        ), (
            f"results.json[{basename!r}].confidence must be a number, "
            f"got {entry['confidence']!r}."
        )
        assert isinstance(entry["file_id"], str) and entry["file_id"], (
            f"results.json[{basename!r}].file_id must be a non-empty string, "
            f"got {entry['file_id']!r}."
        )
        assert isinstance(entry["data"], dict), (
            f"results.json[{basename!r}].data must be an object, "
            f"got {type(entry['data']).__name__}."
        )


def test_results_json_categories_match_log(parsed_log, results_payload):
    for basename, expected_cat in EXPECTED_CATEGORY.items():
        assert results_payload[basename]["category"] == expected_cat, (
            f"results.json[{basename!r}].category must equal {expected_cat!r}."
        )
        assert (
            results_payload[basename]["category"]
            == parsed_log[basename]["category"]
        ), (
            f"results.json[{basename!r}].category must match the log line "
            f"category for the same file."
        )


def test_invoice_extract_data_shape(results_payload):
    for basename, expected_cat in EXPECTED_CATEGORY.items():
        if expected_cat != "invoice":
            continue
        data = results_payload[basename]["data"]
        invoice_number = data.get("invoice_number")
        assert isinstance(invoice_number, str) and invoice_number.strip(), (
            f"results.json[{basename!r}].data.invoice_number must be a non-empty "
            f"string, got {invoice_number!r}."
        )
        vendor_name = data.get("vendor_name")
        assert isinstance(vendor_name, str) and vendor_name.strip(), (
            f"results.json[{basename!r}].data.vendor_name must be a non-empty "
            f"string, got {vendor_name!r}."
        )
        total_amount = data.get("total_amount")
        assert isinstance(total_amount, (int, float)) and not isinstance(
            total_amount, bool
        ), (
            f"results.json[{basename!r}].data.total_amount must be numeric, "
            f"got {total_amount!r}."
        )
        assert total_amount > 0, (
            f"results.json[{basename!r}].data.total_amount must be positive, "
            f"got {total_amount}."
        )
        line_items = data.get("line_items")
        assert isinstance(line_items, list) and len(line_items) >= 1, (
            f"results.json[{basename!r}].data.line_items must be a non-empty "
            f"list, got {line_items!r}."
        )
        for i, item in enumerate(line_items):
            assert isinstance(item, dict), (
                f"line_items[{i}] in {basename!r} must be an object, "
                f"got {type(item).__name__}."
            )
            for k in ("quantity", "unit_price", "total"):
                v = item.get(k)
                assert isinstance(v, (int, float)) and not isinstance(v, bool), (
                    f"line_items[{i}].{k} in {basename!r} must be numeric, "
                    f"got {v!r}."
                )


def test_contract_extract_data_shape(results_payload):
    for basename, expected_cat in EXPECTED_CATEGORY.items():
        if expected_cat != "contract":
            continue
        data = results_payload[basename]["data"]
        parties = data.get("parties")
        assert isinstance(parties, list) and len(parties) >= 2, (
            f"results.json[{basename!r}].data.parties must be a list of length "
            f">=2, got {parties!r}."
        )
        for i, p in enumerate(parties):
            assert isinstance(p, str) and p.strip(), (
                f"results.json[{basename!r}].data.parties[{i}] must be a "
                f"non-empty string, got {p!r}."
            )
        effective_date = data.get("effective_date")
        assert isinstance(effective_date, str) and effective_date.strip(), (
            f"results.json[{basename!r}].data.effective_date must be a "
            f"non-empty string, got {effective_date!r}."
        )
        term = data.get("term")
        assert isinstance(term, str) and term.strip(), (
            f"results.json[{basename!r}].data.term must be a non-empty string, "
            f"got {term!r}."
        )


def _find_file_by_external_id(client, expected_external_id):
    """Return the LlamaCloud file object with the given external_file_id, or None."""
    # Prefer direct query if available.
    try:
        queried = client.files.query(external_file_id=expected_external_id)
    except Exception:
        queried = None

    if queried:
        items = queried if isinstance(queried, list) else [queried]
        for item in items:
            ext = getattr(item, "external_file_id", None)
            if ext == expected_external_id:
                return item

    # Fallback: scan pages of files via list().
    try:
        page = client.files.list()
    except Exception as exc:  # pragma: no cover
        pytest.fail(
            "Unable to list LlamaCloud files to verify external_file_id "
            f"{expected_external_id!r}: {exc}"
        )

    iterator = page if hasattr(page, "__iter__") else getattr(page, "data", [])
    for f in iterator:
        ext = getattr(f, "external_file_id", None)
        if ext == expected_external_id:
            return f
    return None


def test_source_files_external_ids_present(run_id, llama_client, results_payload):
    for basename in EXPECTED_BASENAMES:
        stem = os.path.splitext(basename)[0]
        expected_external_id = f"{run_id}-{stem}"
        found = _find_file_by_external_id(llama_client, expected_external_id)
        assert found is not None, (
            f"Expected a LlamaCloud file with external_file_id == "
            f"{expected_external_id!r} for input {basename!r}, but none was found."
        )
        remote_file_id = getattr(found, "id", None)
        assert isinstance(remote_file_id, str) and remote_file_id, (
            f"Remote file id for {expected_external_id!r} must be a non-empty string, "
            f"got {remote_file_id!r}."
        )
        recorded_file_id = results_payload[basename]["file_id"]
        assert recorded_file_id == remote_file_id, (
            f"results.json[{basename!r}].file_id {recorded_file_id!r} does not "
            f"match the LlamaCloud file id {remote_file_id!r} tagged with "
            f"external_file_id={expected_external_id!r}."
        )
