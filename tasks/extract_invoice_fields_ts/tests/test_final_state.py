import glob
import json
import os
import re

PROJECT_DIR = "/home/user/project"
OUTPUT_JSON = os.path.join(PROJECT_DIR, "output.json")
OUTPUT_LOG = os.path.join(PROJECT_DIR, "output.log")


def _load_output_json():
    assert os.path.isfile(OUTPUT_JSON), (
        f"Expected {OUTPUT_JSON} to exist after the task completes."
    )
    with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as exc:
            raise AssertionError(
                f"{OUTPUT_JSON} is not valid JSON: {exc}"
            ) from exc
    assert isinstance(data, dict), (
        f"Top-level JSON in {OUTPUT_JSON} must be an object, got {type(data).__name__}."
    )
    return data


def test_output_json_exists_and_has_required_keys():
    data = _load_output_json()
    required_keys = {
        "invoice_number",
        "invoice_date",
        "vendor_name",
        "total_amount",
        "line_items",
    }
    missing = required_keys - set(data.keys())
    assert not missing, (
        f"{OUTPUT_JSON} is missing required top-level keys: {sorted(missing)}. "
        f"Found keys: {sorted(data.keys())}."
    )


def test_output_json_invoice_number_matches_sample():
    data = _load_output_json()
    invoice_number = str(data.get("invoice_number", ""))
    assert "INV-2026-0042".lower() in invoice_number.lower(), (
        f"Expected invoice_number to contain 'INV-2026-0042', got {invoice_number!r}."
    )


def test_output_json_vendor_matches_sample():
    data = _load_output_json()
    vendor = str(data.get("vendor_name", ""))
    assert "acme" in vendor.lower(), (
        f"Expected vendor_name to contain 'Acme', got {vendor!r}."
    )


def test_output_json_total_amount_matches_sample():
    data = _load_output_json()
    total = data.get("total_amount")
    assert total is not None, "Missing total_amount in output.json."
    try:
        total_val = float(total)
    except (TypeError, ValueError) as exc:
        raise AssertionError(
            f"total_amount must be numeric, got {total!r} ({type(total).__name__}): {exc}"
        ) from exc
    assert abs(total_val - 175.0) <= 1.0, (
        f"Expected total_amount close to 175.0 (±1.0), got {total_val}."
    )


def test_output_json_line_items_structure():
    data = _load_output_json()
    line_items = data.get("line_items")
    assert isinstance(line_items, list), (
        f"line_items must be a list, got {type(line_items).__name__}."
    )
    assert len(line_items) == 2, (
        f"Expected exactly 2 line items in the sample invoice, got {len(line_items)}."
    )
    first = line_items[0]
    assert isinstance(first, dict), (
        f"Each line item must be an object, got {type(first).__name__}."
    )
    required_item_keys = {"description", "quantity", "unit_price", "total"}
    missing = required_item_keys - set(first.keys())
    assert not missing, (
        f"First line item is missing required keys: {sorted(missing)}. Found: {sorted(first.keys())}."
    )


def test_output_log_summary_line_present():
    assert os.path.isfile(OUTPUT_LOG), (
        f"Expected log file {OUTPUT_LOG} to exist after the task completes."
    )
    with open(OUTPUT_LOG, "r", encoding="utf-8") as f:
        content = f.read()
    pattern = re.compile(
        r"^Extracted Invoice:\s*.*INV-2026-0042.*\|\s*Vendor:\s*.*Acme.*\|\s*Total:\s*.*175.*$",
        re.IGNORECASE | re.MULTILINE,
    )
    assert pattern.search(content), (
        "output.log does not contain a summary line matching the required format "
        "`Extracted Invoice: <invoice_number> | Vendor: <vendor_name> | Total: <total_amount>` "
        f"with the sample invoice values. Got:\n{content}"
    )


def test_agent_used_v2_sdk_and_zod_in_source():
    candidates = []
    for path in glob.glob(os.path.join(PROJECT_DIR, "*.ts")):
        if os.path.isfile(path):
            candidates.append(path)
    # Also allow .ts files one directory deep (e.g., src/main.ts).
    for path in glob.glob(os.path.join(PROJECT_DIR, "*", "*.ts")):
        if "node_modules" in path.split(os.sep):
            continue
        if os.path.isfile(path):
            candidates.append(path)

    assert candidates, (
        f"Expected at least one .ts source file directly under {PROJECT_DIR} (excluding node_modules)."
    )

    required_markers = [
        "@llamaindex/llama-cloud",
        "zod",
        "LlamaCloud",
        "extract",
        "invoice.pdf",
    ]
    for path in candidates:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if all(marker in content for marker in required_markers):
            return
    raise AssertionError(
        "No TypeScript file under the project directory references all of the required markers "
        f"{required_markers}. Checked files: {candidates}."
    )


def test_llama_cloud_npm_package_installed():
    pkg_dir = os.path.join(
        PROJECT_DIR, "node_modules", "@llamaindex", "llama-cloud"
    )
    assert os.path.isdir(pkg_dir), (
        f"Expected @llamaindex/llama-cloud to be installed at {pkg_dir}."
    )


def test_zod_npm_package_installed():
    pkg_dir = os.path.join(PROJECT_DIR, "node_modules", "zod")
    assert os.path.isdir(pkg_dir), (
        f"Expected zod to be installed at {pkg_dir}."
    )


def test_legacy_llama_cloud_services_not_installed():
    legacy_dir = os.path.join(
        PROJECT_DIR, "node_modules", "llama-cloud-services"
    )
    assert not os.path.exists(legacy_dir), (
        "Legacy llama-cloud-services package must NOT be installed; the task targets the new v2 SDK only."
    )
