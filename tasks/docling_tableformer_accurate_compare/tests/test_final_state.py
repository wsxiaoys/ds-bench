import json
import os
import re
import shutil
import subprocess
import sys
import time
import unicodedata

import pytest

PROJECT_DIR = "/home/user/tfbench"
CORPUS_DIR = os.path.join(PROJECT_DIR, "corpus")
GT_DIR = os.path.join(CORPUS_DIR, "ground_truth")
BENCH = os.path.join(PROJECT_DIR, "bench.py")
REPORTS_DIR = os.path.join(PROJECT_DIR, "reports")
VERIFY_DIR = os.path.join(PROJECT_DIR, "_verify")
BUILDER_DIR = "/opt/corpus_builder"

DOC_IDS = ["borderless", "footer_numeric", "grid_basic", "merged_header"]
MODES = ["fast", "accurate"]
GATE_MIN = 0.5

GATE_LINE_RE = re.compile(
    r"^GATE (PASS|FAIL) best_mode=(fast|accurate) cell_match_rate=(\d+\.\d{4})$"
)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def normalize_text(text):
    """Independent oracle for the normalization documented in the task."""
    value = unicodedata.normalize("NFKC", "" if text is None else str(text))
    value = re.sub(r"\s+", " ", value).strip().casefold()
    value = "".join(ch for ch in value if ch.isalnum() or ch in " .-")
    value = re.sub(r" +", " ", value).strip()
    return value


def load_json(path):
    assert os.path.isfile(path), f"Expected JSON artifact {path} to exist."
    with open(path, encoding="utf-8") as handle:
        raw = handle.read()
    assert raw.endswith("\n"), f"JSON artifact {path} must end with a newline."
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AssertionError(f"JSON artifact {path} is not valid JSON: {exc}") from exc


def load_ground_truth():
    data = {}
    for doc_id in DOC_IDS:
        with open(os.path.join(GT_DIR, f"{doc_id}.json"), encoding="utf-8") as handle:
            data[doc_id] = json.load(handle)
    return data


def run_bench(args, timeout=1800):
    start = time.monotonic()
    proc = subprocess.run(
        ["python3", "bench.py", *args],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=timeout,
        env=os.environ.copy(),
    )
    return proc, time.monotonic() - start


def last_stdout_line(proc):
    lines = [line for line in proc.stdout.splitlines() if line.strip()]
    return lines[-1] if lines else ""


def rate(count, total):
    return round(count / total, 4) if total else 0.0


def approx_equal(left, right, tol=1e-6):
    return abs(float(left) - float(right)) <= tol


# --------------------------------------------------------------------------- #
# fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session", autouse=True)
def clean_verify_dir():
    if os.path.isdir(VERIFY_DIR):
        shutil.rmtree(VERIFY_DIR)
    yield
    if os.path.isdir(VERIFY_DIR):
        shutil.rmtree(VERIFY_DIR)


@pytest.fixture(scope="session")
def ground_truth():
    return load_ground_truth()


@pytest.fixture(scope="session")
def full_run_reports():
    """The full-corpus run the executor was required to leave behind."""
    docs = {doc_id: load_json(os.path.join(REPORTS_DIR, "docs", f"{doc_id}.json")) for doc_id in DOC_IDS}
    return {
        "docs": docs,
        "aggregate": load_json(os.path.join(REPORTS_DIR, "aggregate.json")),
        "comparison": load_json(os.path.join(REPORTS_DIR, "comparison.json")),
        "timing": load_json(os.path.join(REPORTS_DIR, "timing.json")),
    }


@pytest.fixture(scope="session")
def repeated_single_mode_runs():
    """Run the harness twice with identical arguments to check determinism."""
    results = []
    for name in ("run1", "run2"):
        out = os.path.join("_verify", name)
        proc, elapsed = run_bench(["--doc", "grid_basic", "--mode", "fast", "--out", out])
        results.append(
            {
                "name": name,
                "out": os.path.join(PROJECT_DIR, out),
                "proc": proc,
                "elapsed": elapsed,
            }
        )
    return results


@pytest.fixture(scope="session")
def mismatch_probe():
    """Ground truth deliberately disagreeing with the rendered PDF (anti-fabrication)."""
    sys.path.insert(0, BUILDER_DIR)
    import build_corpus  # type: ignore

    doc_id = "probe_mismatch"
    pdf_path = os.path.join(CORPUS_DIR, f"{doc_id}.pdf")
    gt_path = os.path.join(GT_DIR, f"{doc_id}.json")
    visible = [
        ["Alpha", "Beta", "Gamma"],
        ["Delta", "Epsilon", "Zeta"],
        ["Eta", "Theta", "Iota"],
    ]
    elements = [
        {"type": "heading", "text": "Probe Table"},
        {
            "type": "table",
            "bordered": True,
            "header_rows": 1,
            "col_widths": [140.0, 140.0, 140.0],
            "rows": [[{"text": cell} for cell in row] for row in visible],
        },
    ]
    try:
        truth = build_corpus.write_document(pdf_path, doc_id, elements)
        counter = 0
        for table in truth["tables"]:
            for cell in table["cells"]:
                counter += 1
                cell["text"] = f"zzq{counter}"
        with open(gt_path, "w", encoding="utf-8") as handle:
            json.dump(truth, handle, indent=2)
            handle.write("\n")
        proc, elapsed = run_bench(["--doc", doc_id, "--mode", "fast", "--out", "_verify/probe"])
    finally:
        # Restore the corpus immediately so later probes see a pristine corpus.
        for path in (pdf_path, gt_path):
            if os.path.exists(path):
                os.remove(path)
    return {
        "doc_id": doc_id,
        "proc": proc,
        "elapsed": elapsed,
        "out": os.path.join(PROJECT_DIR, "_verify", "probe"),
    }


@pytest.fixture(scope="session")
def orphan_probe():
    """A corpus PDF without any ground truth file."""
    doc_id = "orphan_probe"
    pdf_path = os.path.join(CORPUS_DIR, f"{doc_id}.pdf")
    try:
        shutil.copyfile(os.path.join(CORPUS_DIR, "grid_basic.pdf"), pdf_path)
        proc, _ = run_bench(["--doc", doc_id, "--mode", "fast", "--out", "_verify/orphan"])
    finally:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
    return {"proc": proc, "out": os.path.join(PROJECT_DIR, "_verify", "orphan")}


@pytest.fixture(scope="session")
def broken_probe():
    """A corpus entry whose PDF cannot be converted at all."""
    doc_id = "broken_probe"
    pdf_path = os.path.join(CORPUS_DIR, f"{doc_id}.pdf")
    gt_path = os.path.join(GT_DIR, f"{doc_id}.json")
    truth = {
        "doc_id": doc_id,
        "pdf": f"{doc_id}.pdf",
        "page_count": 1,
        "tables": [
            {
                "table_index": 0,
                "page_no": 1,
                "num_rows": 2,
                "num_cols": 2,
                "cells": [
                    {"row": r, "col": c, "row_span": 1, "col_span": 1,
                     "text": f"c{r}{c}", "is_header": r == 0}
                    for r in range(2)
                    for c in range(2)
                ],
            }
        ],
    }
    try:
        with open(pdf_path, "wb") as handle:
            handle.write(b"this is definitely not a pdf file\n" * 8)
        with open(gt_path, "w", encoding="utf-8") as handle:
            json.dump(truth, handle, indent=2)
            handle.write("\n")
        proc, _ = run_bench(["--doc", doc_id, "--mode", "fast", "--out", "_verify/broken"])
    finally:
        # Restore the corpus immediately so later checks see a pristine corpus.
        for path in (pdf_path, gt_path):
            if os.path.exists(path):
                os.remove(path)
    return {"doc_id": doc_id, "proc": proc, "out": os.path.join(PROJECT_DIR, "_verify", "broken")}


# --------------------------------------------------------------------------- #
# tests
# --------------------------------------------------------------------------- #
def test_deliverable_artifacts_exist():
    assert os.path.isfile(BENCH), f"The benchmark harness {BENCH} does not exist."
    for name in ("aggregate.json", "comparison.json", "timing.json"):
        path = os.path.join(REPORTS_DIR, name)
        assert os.path.isfile(path), f"Expected the full-corpus run artifact {path} to exist."
        load_json(path)
    for doc_id in DOC_IDS:
        path = os.path.join(REPORTS_DIR, "docs", f"{doc_id}.json")
        assert os.path.isfile(path), f"Expected the per-document report {path} to exist."
        load_json(path)


def test_corpus_ground_truth_unmodified(ground_truth):
    expected = {
        "grid_basic": [(5, 4, 20)],
        "merged_header": [(5, 5, 22)],
        "borderless": [(4, 3, 12)],
        "footer_numeric": [(5, 3, 14), (3, 2, 6)],
    }
    empty_text_cells = 0
    row_span_cells = 0
    col_span_cells = 0
    for doc_id, shapes in expected.items():
        tables = ground_truth[doc_id]["tables"]
        assert len(tables) == len(shapes), (
            f"Ground truth for {doc_id} must still declare {len(shapes)} table(s), "
            f"found {len(tables)} - the corpus must not be modified."
        )
        for table, (rows, cols, cells) in zip(tables, shapes):
            assert (table["num_rows"], table["num_cols"]) == (rows, cols), (
                f"Ground truth table {doc_id}#{table['table_index']} must still be "
                f"{rows}x{cols}, found {table['num_rows']}x{table['num_cols']}."
            )
            assert len(table["cells"]) == cells, (
                f"Ground truth table {doc_id}#{table['table_index']} must still have "
                f"{cells} cells, found {len(table['cells'])}."
            )
            for cell in table["cells"]:
                if cell["text"] == "":
                    empty_text_cells += 1
                if cell["row_span"] > 1:
                    row_span_cells += 1
                if cell["col_span"] > 1:
                    col_span_cells += 1
    assert empty_text_cells >= 1, "The corpus ground truth must still contain an empty-text cell."
    assert row_span_cells >= 1, "The corpus ground truth must still contain a row-spanning cell."
    assert col_span_cells >= 3, (
        f"The corpus ground truth must still contain at least 3 column-spanning cells, "
        f"found {col_span_cells}."
    )


def test_per_document_report_structure(full_run_reports, ground_truth):
    doc_keys = {"doc_id", "pdf", "gt_table_count", "gt_cell_count", "modes"}
    mode_keys = {
        "mode",
        "cell_matching",
        "converted",
        "error",
        "predicted_table_count",
        "unmatched_predicted_tables",
        "tables",
    }
    for doc_id in DOC_IDS:
        report = full_run_reports["docs"][doc_id]
        assert doc_keys.issubset(report.keys()), (
            f"reports/docs/{doc_id}.json is missing keys: {sorted(doc_keys - set(report.keys()))}"
        )
        assert report["doc_id"] == doc_id, f"reports/docs/{doc_id}.json has a wrong doc_id."
        assert report["pdf"] == f"{doc_id}.pdf", f"reports/docs/{doc_id}.json has a wrong pdf field."
        gt_tables = ground_truth[doc_id]["tables"]
        gt_cells = sum(len(t["cells"]) for t in gt_tables)
        assert report["gt_table_count"] == len(gt_tables), (
            f"reports/docs/{doc_id}.json gt_table_count should be {len(gt_tables)}."
        )
        assert report["gt_cell_count"] == gt_cells, (
            f"reports/docs/{doc_id}.json gt_cell_count should be {gt_cells}."
        )
        assert set(report["modes"].keys()) == set(MODES), (
            f"reports/docs/{doc_id}.json modes must be exactly {MODES}, "
            f"found {sorted(report['modes'].keys())}."
        )
        for mode in MODES:
            block = report["modes"][mode]
            assert mode_keys.issubset(block.keys()), (
                f"reports/docs/{doc_id}.json mode '{mode}' is missing keys: "
                f"{sorted(mode_keys - set(block.keys()))}"
            )
            assert block["mode"] == mode, f"reports/docs/{doc_id}.json mode '{mode}' mislabelled."
            assert block["cell_matching"] is True, (
                f"reports/docs/{doc_id}.json mode '{mode}' must record cell_matching as true."
            )
            assert block["converted"] is True, (
                f"reports/docs/{doc_id}.json mode '{mode}' reports a failed conversion: "
                f"{block.get('error')}"
            )
            assert block["error"] is None, (
                f"reports/docs/{doc_id}.json mode '{mode}' should have a null error."
            )
            assert len(block["tables"]) == len(gt_tables), (
                f"reports/docs/{doc_id}.json mode '{mode}' must score exactly "
                f"{len(gt_tables)} ground truth table(s)."
            )
            indices = [t["table_index"] for t in block["tables"]]
            assert indices == list(range(len(gt_tables))), (
                f"reports/docs/{doc_id}.json mode '{mode}' tables must be ordered by "
                f"table_index 0..n-1, found {indices}."
            )


def test_ground_truth_cell_records_and_normalization(full_run_reports, ground_truth):
    checked = 0
    for doc_id in DOC_IDS:
        report = full_run_reports["docs"][doc_id]
        for mode in MODES:
            for gt_table, table in zip(ground_truth[doc_id]["tables"], report["modes"][mode]["tables"]):
                assert table["page_no"] == gt_table["page_no"], (
                    f"{doc_id}/{mode} table {table['table_index']} page_no should be "
                    f"{gt_table['page_no']}."
                )
                assert table["gt_shape"] == [gt_table["num_rows"], gt_table["num_cols"]], (
                    f"{doc_id}/{mode} table {table['table_index']} gt_shape should be "
                    f"[{gt_table['num_rows']}, {gt_table['num_cols']}]."
                )
                assert table["gt_cell_count"] == len(gt_table["cells"]), (
                    f"{doc_id}/{mode} table {table['table_index']} gt_cell_count is wrong."
                )
                gt_by_pos = {(c["row"], c["col"]): c for c in gt_table["cells"]}
                cells = table["cells"]
                assert len(cells) == len(gt_by_pos), (
                    f"{doc_id}/{mode} table {table['table_index']} must contain exactly one "
                    f"record per ground truth cell ({len(gt_by_pos)}), found {len(cells)}."
                )
                positions = [(c["row"], c["col"]) for c in cells]
                assert positions == sorted(gt_by_pos.keys()), (
                    f"{doc_id}/{mode} table {table['table_index']} cells must be ordered by "
                    f"(row, col); got {positions}."
                )
                for cell in cells:
                    gt_cell = gt_by_pos[(cell["row"], cell["col"])]
                    assert cell["gt_span"] == [gt_cell["row_span"], gt_cell["col_span"]], (
                        f"{doc_id}/{mode} cell {cell['row']},{cell['col']} gt_span should be "
                        f"[{gt_cell['row_span']}, {gt_cell['col_span']}]."
                    )
                    assert cell["gt_header"] == gt_cell["is_header"], (
                        f"{doc_id}/{mode} cell {cell['row']},{cell['col']} gt_header should be "
                        f"{gt_cell['is_header']}."
                    )
                    expected_norm = normalize_text(gt_cell["text"])
                    assert cell["gt_text_normalized"] == expected_norm, (
                        f"{doc_id}/{mode} cell {cell['row']},{cell['col']} gt_text_normalized "
                        f"should be {expected_norm!r} for source text {gt_cell['text']!r}, "
                        f"found {cell['gt_text_normalized']!r}."
                    )
                    checked += 1
    assert checked == 148, (
        f"Expected 148 ground-truth cell records across both modes, checked {checked}."
    )


def test_per_table_metric_consistency(full_run_reports):
    for doc_id in DOC_IDS:
        report = full_run_reports["docs"][doc_id]
        for mode in MODES:
            for table in report["modes"][mode]["tables"]:
                label = f"{doc_id}/{mode}/table{table['table_index']}"
                matched = 0
                spans = 0
                headers = 0
                for cell in table["cells"]:
                    expected_match = (
                        cell["pred_text_normalized"] is not None
                        and cell["pred_text_normalized"] == cell["gt_text_normalized"]
                    )
                    assert cell["matched"] is expected_match, (
                        f"{label} cell {cell['row']},{cell['col']}: 'matched' must be the "
                        f"equality of the normalized texts."
                    )
                    expected_span = (
                        cell["pred_span"] is not None and cell["pred_span"] == cell["gt_span"]
                    )
                    assert cell["span_match"] is expected_span, (
                        f"{label} cell {cell['row']},{cell['col']}: 'span_match' disagrees with "
                        f"the recorded spans."
                    )
                    expected_header = (
                        cell["pred_header"] is not None
                        and cell["pred_header"] == cell["gt_header"]
                    )
                    assert cell["header_match"] is expected_header, (
                        f"{label} cell {cell['row']},{cell['col']}: 'header_match' disagrees "
                        f"with the recorded header flags."
                    )
                    if cell["pred_span"] is None:
                        assert cell["pred_text_normalized"] is None and cell["pred_header"] is None, (
                            f"{label} cell {cell['row']},{cell['col']}: a probe without a "
                            f"recognized counterpart must have null text, span and header."
                        )
                    matched += 1 if expected_match else 0
                    spans += 1 if expected_span else 0
                    headers += 1 if expected_header else 0
                total = table["gt_cell_count"]
                assert table["matched_cells"] == matched, f"{label}: matched_cells is wrong."
                assert table["span_agreements"] == spans, f"{label}: span_agreements is wrong."
                assert table["header_agreements"] == headers, f"{label}: header_agreements is wrong."
                assert approx_equal(table["cell_match_rate"], rate(matched, total)), (
                    f"{label}: cell_match_rate should be {rate(matched, total)}."
                )
                assert approx_equal(table["span_match_rate"], rate(spans, total)), (
                    f"{label}: span_match_rate should be {rate(spans, total)}."
                )
                assert approx_equal(table["header_match_rate"], rate(headers, total)), (
                    f"{label}: header_match_rate should be {rate(headers, total)}."
                )
                assert table["shape_match"] is (table["pred_shape"] == table["gt_shape"]), (
                    f"{label}: shape_match must be true exactly when pred_shape equals gt_shape."
                )


def test_aggregate_report_consistency(full_run_reports, ground_truth):
    aggregate = full_run_reports["aggregate"]
    assert aggregate["corpus_dir"] == "corpus", (
        f"aggregate.json corpus_dir should be 'corpus', found {aggregate['corpus_dir']!r}."
    )
    assert aggregate["doc_ids"] == DOC_IDS, (
        f"aggregate.json doc_ids should be {DOC_IDS}, found {aggregate['doc_ids']}."
    )
    assert aggregate["doc_count"] == 4, "aggregate.json doc_count should be 4."
    gt_tables = sum(len(ground_truth[d]["tables"]) for d in DOC_IDS)
    gt_cells = sum(len(t["cells"]) for d in DOC_IDS for t in ground_truth[d]["tables"])
    assert aggregate["gt_table_count"] == gt_tables == 5, (
        f"aggregate.json gt_table_count should be {gt_tables}."
    )
    assert aggregate["gt_cell_count"] == gt_cells, (
        f"aggregate.json gt_cell_count should be {gt_cells}."
    )
    assert set(aggregate["modes"].keys()) == set(MODES), (
        f"aggregate.json modes must be exactly {MODES}."
    )
    for mode in MODES:
        block = aggregate["modes"][mode]
        tables = [
            table
            for doc_id in DOC_IDS
            for table in full_run_reports["docs"][doc_id]["modes"][mode]["tables"]
        ]
        matched = sum(t["matched_cells"] for t in tables)
        spans = sum(t["span_agreements"] for t in tables)
        headers = sum(t["header_agreements"] for t in tables)
        shapes = sum(1 for t in tables if t["shape_match"])
        predicted = sum(
            full_run_reports["docs"][d]["modes"][mode]["predicted_table_count"] for d in DOC_IDS
        )
        assert block["cell_matching"] is True, f"aggregate.json {mode}.cell_matching must be true."
        assert block["documents_run"] == 4, f"aggregate.json {mode}.documents_run should be 4."
        assert block["documents_converted"] == 4, (
            f"aggregate.json {mode}.documents_converted should be 4."
        )
        assert block["documents_failed"] == 0, f"aggregate.json {mode}.documents_failed should be 0."
        assert block["predicted_table_count"] == predicted, (
            f"aggregate.json {mode}.predicted_table_count should be {predicted}."
        )
        assert block["matched_cells"] == matched, (
            f"aggregate.json {mode}.matched_cells should be {matched}."
        )
        assert block["span_agreements"] == spans, (
            f"aggregate.json {mode}.span_agreements should be {spans}."
        )
        assert block["header_agreements"] == headers, (
            f"aggregate.json {mode}.header_agreements should be {headers}."
        )
        assert block["shape_match_count"] == shapes, (
            f"aggregate.json {mode}.shape_match_count should be {shapes}."
        )
        assert approx_equal(block["cell_match_rate"], rate(matched, gt_cells)), (
            f"aggregate.json {mode}.cell_match_rate must be micro-averaged: "
            f"{rate(matched, gt_cells)}."
        )
        assert approx_equal(block["span_match_rate"], rate(spans, gt_cells)), (
            f"aggregate.json {mode}.span_match_rate must be micro-averaged."
        )
        assert approx_equal(block["header_match_rate"], rate(headers, gt_cells)), (
            f"aggregate.json {mode}.header_match_rate must be micro-averaged."
        )
        assert approx_equal(block["shape_match_rate"], rate(shapes, gt_tables)), (
            f"aggregate.json {mode}.shape_match_rate should be {rate(shapes, gt_tables)}."
        )

    fast_rate = aggregate["modes"]["fast"]["cell_match_rate"]
    accurate_rate = aggregate["modes"]["accurate"]["cell_match_rate"]
    expected_best = "accurate" if accurate_rate > fast_rate else "fast"
    assert aggregate["best_mode"] == expected_best, (
        f"aggregate.json best_mode should be {expected_best} "
        f"(fast={fast_rate}, accurate={accurate_rate})."
    )
    assert approx_equal(aggregate["best_cell_match_rate"], max(fast_rate, accurate_rate)), (
        "aggregate.json best_cell_match_rate must be the best mode's cell_match_rate."
    )


def test_quality_gate_passed(full_run_reports):
    aggregate = full_run_reports["aggregate"]
    gate = aggregate["quality_gate"]
    assert approx_equal(gate["min_cell_match_rate"], GATE_MIN), (
        f"aggregate.json quality_gate.min_cell_match_rate should be {GATE_MIN}."
    )
    assert aggregate["best_cell_match_rate"] >= GATE_MIN, (
        f"The benchmark quality gate requires a best cell match rate of at least {GATE_MIN}, "
        f"found {aggregate['best_cell_match_rate']}."
    )
    assert gate["passed"] is True, "aggregate.json quality_gate.passed should be true."


def test_real_table_recognition_evidence(full_run_reports):
    aggregate = full_run_reports["aggregate"]
    predicted = [aggregate["modes"][m]["predicted_table_count"] for m in MODES]
    assert max(predicted) >= 3, (
        f"At least one mode must have recognized 3 or more tables in the corpus, found {predicted}."
    )
    shapes = [aggregate["modes"][m]["shape_match_count"] for m in MODES]
    assert max(shapes) >= 1, (
        f"At least one mode must reproduce the exact grid shape of at least one table, found {shapes}."
    )
    grid_pred = [
        full_run_reports["docs"]["grid_basic"]["modes"][m]["predicted_table_count"] for m in MODES
    ]
    assert max(grid_pred) >= 1, (
        f"The simple bordered table document 'grid_basic' must yield at least one recognized "
        f"table in at least one mode, found {grid_pred}."
    )

    seen_bbox = 0
    for doc_id in DOC_IDS:
        for mode in MODES:
            for table in full_run_reports["docs"][doc_id]["modes"][mode]["tables"]:
                bbox = table["pred_bbox"]
                if bbox is None:
                    assert table["pred_page_no"] is None, (
                        f"{doc_id}/{mode}: pred_page_no must be null when pred_bbox is null."
                    )
                    continue
                seen_bbox += 1
                assert isinstance(bbox, list) and len(bbox) == 4, (
                    f"{doc_id}/{mode}: pred_bbox must be a list of 4 numbers, found {bbox}."
                )
                for value in bbox:
                    assert isinstance(value, (int, float)) and not isinstance(value, bool), (
                        f"{doc_id}/{mode}: pred_bbox values must be numbers, found {bbox}."
                    )
                    assert 0.0 <= float(value) <= 1000.0, (
                        f"{doc_id}/{mode}: pred_bbox value {value} is outside the page."
                    )
                assert float(bbox[0]) < float(bbox[2]), (
                    f"{doc_id}/{mode}: pred_bbox left must be smaller than right, found {bbox}."
                )
                assert table["pred_page_no"] == 1, (
                    f"{doc_id}/{mode}: every corpus document is single-page, so pred_page_no "
                    f"must be 1, found {table['pred_page_no']}."
                )
    assert seen_bbox >= 3, (
        f"Expected provenance boxes for at least 3 recognized tables, found {seen_bbox}."
    )


def test_comparison_report(full_run_reports, ground_truth):
    comparison = full_run_reports["comparison"]
    assert comparison["modes"] == MODES, f"comparison.json modes should be {MODES}."
    expected_keys = [
        (doc_id, table["table_index"])
        for doc_id in DOC_IDS
        for table in ground_truth[doc_id]["tables"]
    ]
    actual_keys = [(entry["doc_id"], entry["table_index"]) for entry in comparison["tables"]]
    assert actual_keys == sorted(expected_keys), (
        f"comparison.json must hold one entry per ground truth table ordered by "
        f"(doc_id, table_index); expected {sorted(expected_keys)}, found {actual_keys}."
    )

    tallies = {"accurate_better": 0, "fast_better": 0, "tie": 0}
    shape_differs = 0
    for entry in comparison["tables"]:
        doc_id = entry["doc_id"]
        idx = entry["table_index"]
        fast_table = full_run_reports["docs"][doc_id]["modes"]["fast"]["tables"][idx]
        acc_table = full_run_reports["docs"][doc_id]["modes"]["accurate"]["tables"][idx]
        assert entry["fast_shape"] == fast_table["pred_shape"], (
            f"comparison.json {doc_id}#{idx}: fast_shape disagrees with the per-document report."
        )
        assert entry["accurate_shape"] == acc_table["pred_shape"], (
            f"comparison.json {doc_id}#{idx}: accurate_shape disagrees with the per-document report."
        )
        assert entry["shape_differs"] is (entry["fast_shape"] != entry["accurate_shape"]), (
            f"comparison.json {doc_id}#{idx}: shape_differs is inconsistent."
        )
        assert approx_equal(entry["fast_cell_match_rate"], fast_table["cell_match_rate"]), (
            f"comparison.json {doc_id}#{idx}: fast_cell_match_rate disagrees with the report."
        )
        assert approx_equal(entry["accurate_cell_match_rate"], acc_table["cell_match_rate"]), (
            f"comparison.json {doc_id}#{idx}: accurate_cell_match_rate disagrees with the report."
        )
        expected_delta = round(
            acc_table["cell_match_rate"] - fast_table["cell_match_rate"], 4
        )
        assert approx_equal(entry["cell_match_rate_delta"], expected_delta), (
            f"comparison.json {doc_id}#{idx}: cell_match_rate_delta should be {expected_delta}."
        )
        if expected_delta > 0:
            expected_verdict = "accurate_better"
        elif expected_delta < 0:
            expected_verdict = "fast_better"
        else:
            expected_verdict = "tie"
        assert entry["verdict"] == expected_verdict, (
            f"comparison.json {doc_id}#{idx}: verdict should be {expected_verdict}."
        )
        fast_cells = {(c["row"], c["col"]): c["pred_text_normalized"] for c in fast_table["cells"]}
        acc_cells = {(c["row"], c["col"]): c["pred_text_normalized"] for c in acc_table["cells"]}
        expected_diff = sorted([r, c] for (r, c) in fast_cells if fast_cells[(r, c)] != acc_cells[(r, c)])
        assert entry["differing_cells"] == expected_diff, (
            f"comparison.json {doc_id}#{idx}: differing_cells should be {expected_diff}, "
            f"found {entry['differing_cells']}."
        )
        assert entry["differing_cell_count"] == len(expected_diff), (
            f"comparison.json {doc_id}#{idx}: differing_cell_count should be {len(expected_diff)}."
        )
        tallies[expected_verdict] += 1
        shape_differs += 1 if entry["shape_differs"] else 0

    summary = comparison["summary"]
    assert summary["tables_compared"] == len(comparison["tables"]) == 5, (
        "comparison.json summary.tables_compared should be 5."
    )
    for verdict, count in tallies.items():
        assert summary[verdict] == count, (
            f"comparison.json summary.{verdict} should be {count}, found {summary[verdict]}."
        )
    assert summary["shape_differs_count"] == shape_differs, (
        f"comparison.json summary.shape_differs_count should be {shape_differs}."
    )


def test_timing_report(full_run_reports):
    timing = full_run_reports["timing"]
    assert set(timing["modes"].keys()) == set(MODES), (
        f"timing.json must report both modes, found {sorted(timing['modes'].keys())}."
    )
    for mode in MODES:
        block = timing["modes"][mode]
        assert block["documents"] == 4, f"timing.json {mode}.documents should be 4."
        for key in ("total_seconds", "mean_seconds_per_document", "min_seconds", "max_seconds"):
            assert isinstance(block[key], (int, float)) and not isinstance(block[key], bool), (
                f"timing.json {mode}.{key} must be a number."
            )
            assert block[key] > 0, f"timing.json {mode}.{key} must be positive."
        assert block["min_seconds"] <= block["mean_seconds_per_document"] <= block["max_seconds"], (
            f"timing.json {mode}: min <= mean <= max is violated."
        )
        expected_mean = round(block["total_seconds"] / block["documents"], 3)
        assert approx_equal(block["mean_seconds_per_document"], expected_mean, tol=0.01), (
            f"timing.json {mode}.mean_seconds_per_document should be {expected_mean}."
        )
        assert timing["total_seconds"] >= block["total_seconds"] - 1e-6, (
            f"timing.json total_seconds must be at least {mode}'s total_seconds."
        )


def test_repeated_runs_are_byte_identical(repeated_single_mode_runs):
    for run in repeated_single_mode_runs:
        proc = run["proc"]
        assert proc.returncode in (0, 3), (
            f"'bench.py --doc grid_basic --mode fast' should exit 0 or 3, got "
            f"{proc.returncode}. stderr:\n{proc.stderr[-3000:]}"
        )
    first, second = repeated_single_mode_runs
    for relative in (os.path.join("docs", "grid_basic.json"), "aggregate.json"):
        path_a = os.path.join(first["out"], relative)
        path_b = os.path.join(second["out"], relative)
        assert os.path.isfile(path_a), f"{path_a} was not produced."
        assert os.path.isfile(path_b), f"{path_b} was not produced."
        with open(path_a, "rb") as handle_a, open(path_b, "rb") as handle_b:
            data_a = handle_a.read()
            data_b = handle_b.read()
        assert data_a == data_b, (
            f"Two identical runs produced different {relative} - reports must be deterministic."
        )


def test_repeated_runs_perform_real_inference(repeated_single_mode_runs):
    for run in repeated_single_mode_runs:
        assert run["elapsed"] > 3.0, (
            f"Run {run['name']} finished in {run['elapsed']:.2f}s, which is too fast for a real "
            f"table-structure recognition pass."
        )


def test_single_mode_run_artifacts(repeated_single_mode_runs):
    for run in repeated_single_mode_runs:
        report = load_json(os.path.join(run["out"], "docs", "grid_basic.json"))
        assert set(report["modes"].keys()) == {"fast"}, (
            f"A --mode fast run must report only the 'fast' mode, found "
            f"{sorted(report['modes'].keys())}."
        )
        aggregate = load_json(os.path.join(run["out"], "aggregate.json"))
        assert aggregate["doc_ids"] == ["grid_basic"], (
            f"A --doc grid_basic run must aggregate only that document, found {aggregate['doc_ids']}."
        )
        assert aggregate["best_mode"] == "fast", "A single-mode fast run must report best_mode fast."
        assert set(aggregate["modes"].keys()) == {"fast"}, (
            "aggregate.json must contain only the modes that were run."
        )
        assert os.path.isfile(os.path.join(run["out"], "timing.json")), (
            "timing.json must be written for every run."
        )
        assert not os.path.exists(os.path.join(run["out"], "comparison.json")), (
            "comparison.json must not be written when only one mode ran."
        )


def test_stdout_gate_line(repeated_single_mode_runs):
    for run in repeated_single_mode_runs:
        line = last_stdout_line(run["proc"])
        match = GATE_LINE_RE.match(line)
        assert match is not None, (
            f"The last non-empty stdout line must match "
            f"'GATE <PASS|FAIL> best_mode=<mode> cell_match_rate=<0.0000>', got {line!r}."
        )
        aggregate = load_json(os.path.join(run["out"], "aggregate.json"))
        assert match.group(2) == aggregate["best_mode"], (
            "The GATE line's best_mode must match aggregate.json."
        )
        assert approx_equal(float(match.group(3)), aggregate["best_cell_match_rate"], tol=5e-5), (
            f"The GATE line's cell_match_rate {match.group(3)} must match aggregate.json "
            f"({aggregate['best_cell_match_rate']})."
        )
        expected_status = "PASS" if aggregate["quality_gate"]["passed"] else "FAIL"
        assert match.group(1) == expected_status, (
            f"The GATE line status should be {expected_status}."
        )
        assert (run["proc"].returncode == 0) == (expected_status == "PASS"), (
            "Exit code 0 must be used exactly when the gate passed."
        )


def test_scores_come_from_the_model_not_the_ground_truth(mismatch_probe):
    proc = mismatch_probe["proc"]
    assert proc.returncode == 3, (
        f"A run whose ground truth cannot be matched must fail the quality gate with exit code 3, "
        f"got {proc.returncode}. stderr:\n{proc.stderr[-3000:]}"
    )
    report = load_json(
        os.path.join(mismatch_probe["out"], "docs", f"{mismatch_probe['doc_id']}.json")
    )
    tables = report["modes"]["fast"]["tables"]
    assert len(tables) == 1, f"The probe document has exactly one ground truth table."
    assert tables[0]["cell_match_rate"] <= 0.34, (
        f"The probe's ground truth deliberately disagrees with the rendered PDF, so the reported "
        f"cell_match_rate must stay low; found {tables[0]['cell_match_rate']} - the harness "
        f"appears to score the ground truth against itself instead of the recognized table."
    )
    aggregate = load_json(os.path.join(mismatch_probe["out"], "aggregate.json"))
    assert aggregate["quality_gate"]["passed"] is False, (
        "The probe run must report a failed quality gate."
    )


def test_missing_ground_truth_is_a_selection_error(orphan_probe):
    proc = orphan_probe["proc"]
    assert proc.returncode == 4, (
        f"A corpus PDF without a ground truth file must exit with code 4, got {proc.returncode}. "
        f"stderr:\n{proc.stderr[-3000:]}"
    )
    assert proc.stderr.strip(), "A selection error must print a message on stderr."
    assert "GATE" not in proc.stdout, "A selection error must not print a GATE line."
    out_dir = orphan_probe["out"]
    produced = []
    for root, _dirs, files in os.walk(out_dir):
        produced.extend(os.path.join(root, name) for name in files)
    assert produced == [], f"A selection error must not write any report, found {produced}."


def test_unknown_document_is_a_selection_error():
    proc, _ = run_bench(["--doc", "does_not_exist", "--mode", "fast", "--out", "_verify/unknown"])
    assert proc.returncode == 4, (
        f"An unknown --doc value must exit with code 4, got {proc.returncode}. "
        f"stderr:\n{proc.stderr[-3000:]}"
    )
    assert proc.stderr.strip(), "An unknown --doc value must print a message on stderr."
    assert "GATE" not in proc.stdout, "An unknown --doc value must not print a GATE line."
    out_dir = os.path.join(PROJECT_DIR, "_verify", "unknown")
    produced = []
    for root, _dirs, files in os.walk(out_dir):
        produced.extend(os.path.join(root, name) for name in files)
    assert produced == [], f"A selection error must not write any report, found {produced}."


def test_conversion_failure_is_reported_and_exits_five(broken_probe):
    proc = broken_probe["proc"]
    assert proc.returncode == 5, (
        f"A document that cannot be converted must exit with code 5, got {proc.returncode}. "
        f"stderr:\n{proc.stderr[-3000:]}"
    )
    report = load_json(os.path.join(broken_probe["out"], "docs", f"{broken_probe['doc_id']}.json"))
    block = report["modes"]["fast"]
    assert block["converted"] is False, "A failed conversion must be recorded with converted=false."
    assert isinstance(block["error"], str) and block["error"].strip(), (
        "A failed conversion must record a non-empty error string."
    )
    assert len(block["tables"]) == 1, (
        "A failed conversion must still score every ground truth table as a total miss."
    )
    table = block["tables"][0]
    assert table["pred_shape"] is None, "A failed conversion must have a null pred_shape."
    assert table["matched_cells"] == 0, "A failed conversion cannot have matched cells."
    assert approx_equal(table["cell_match_rate"], 0.0), (
        "A failed conversion must report a zero cell_match_rate."
    )
    aggregate = load_json(os.path.join(broken_probe["out"], "aggregate.json"))
    assert aggregate["modes"]["fast"]["documents_failed"] == 1, (
        "aggregate.json must count the failed document."
    )
    assert approx_equal(aggregate["modes"]["fast"]["cell_match_rate"], 0.0), (
        "aggregate.json must report a zero cell_match_rate for the failed run."
    )


def test_invalid_mode_argument_exits_two():
    proc, _ = run_bench(["--mode", "turbo", "--out", "_verify/invalid"])
    assert proc.returncode == 2, (
        f"An invalid --mode value must exit with code 2, got {proc.returncode}. "
        f"stderr:\n{proc.stderr[-2000:]}"
    )
    out_dir = os.path.join(PROJECT_DIR, "_verify", "invalid")
    produced = []
    for root, _dirs, files in os.walk(out_dir):
        produced.extend(os.path.join(root, name) for name in files)
    assert produced == [], f"Invalid usage must not write any report, found {produced}."
