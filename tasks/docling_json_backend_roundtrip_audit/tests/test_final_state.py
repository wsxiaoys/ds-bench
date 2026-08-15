import hashlib
import json
import os
import shutil
import subprocess
from io import BytesIO
from pathlib import Path

import pytest
from docling.backend.json.docling_json_backend import DoclingJSONBackend
from docling.datamodel.base_models import InputFormat
from docling.datamodel.document import InputDocument
from docling_core.types.doc import DoclingDocument

PROJECT_DIR = "/home/user/project"
INBOX_DIR = os.path.join(PROJECT_DIR, "assets", "inbox")
OUT_DIR = os.path.join(PROJECT_DIR, "out")
OUT_DIR_2 = os.path.join(PROJECT_DIR, "out2")
VALID_ONLY_DIR = "/tmp/valid_only"
VALID_ONLY_OUT = "/tmp/valid_only_out"
NO_JSON_DIR = "/tmp/no_json"
NO_JSON_OUT = "/tmp/no_json_out"
MISSING_DIR = "/tmp/does_not_exist_dir"

CMD = ["python", "-m", "docaudit.cli"]
TIMEOUT = 900

CURRENT_SCHEMA_VERSION = DoclingDocument(name="probe").version

OK_FILES = ["alpha_report.json", "beta_notes.json", "gamma_legacy.json"]
EXPECTED_ORDER = [
    "alpha_report.json",
    "beta_notes.json",
    "delta_truncated.json",
    "epsilon_empty_object.json",
    "eta_future_version.json",
    "gamma_legacy.json",
    "theta_bad_types.json",
    "zeta_array.json",
]
EXPECTED_STATUS = {
    "alpha_report.json": "ok",
    "beta_notes.json": "ok",
    "gamma_legacy.json": "ok",
    "delta_truncated.json": "malformed_json",
    "epsilon_empty_object.json": "schema_invalid",
    "theta_bad_types.json": "schema_invalid",
    "eta_future_version.json": "version_mismatch",
    "zeta_array.json": "not_an_object",
}
INGESTED_FILES = [
    "alpha_report.json",
    "beta_notes.json",
    "eta_future_version.json",
    "gamma_legacy.json",
]
REJECTED_FILES = [
    "delta_truncated.json",
    "epsilon_empty_object.json",
    "theta_bad_types.json",
    "zeta_array.json",
]


def _read_fixture(name):
    with open(os.path.join(INBOX_DIR, name), "rb") as handle:
        return handle.read()


def _ingest_bytes(raw, filename, tmp_dir):
    """Ingest raw Docling JSON bytes through the real Docling JSON backend."""
    path = Path(tmp_dir) / filename
    path.write_bytes(raw)
    in_doc = InputDocument(
        path_or_stream=path,
        format=InputFormat.JSON_DOCLING,
        backend=DoclingJSONBackend,
    )
    backend = DoclingJSONBackend(in_doc=in_doc, path_or_stream=path)
    assert backend.is_valid(), f"Oracle could not ingest {filename}."
    return backend.convert()


@pytest.fixture(scope="session")
def oracle(tmp_path_factory):
    """Independently recompute the expected document artifacts with Docling."""
    tmp_dir = tmp_path_factory.mktemp("oracle")
    docs = {}
    for name in INGESTED_FILES:
        raw = _read_fixture(name)
        if name == "eta_future_version.json":
            payload = json.loads(raw.decode("utf-8"))
            payload["version"] = CURRENT_SCHEMA_VERSION
            raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        doc = _ingest_bytes(raw, name, tmp_dir)
        exported = doc.export_to_dict()
        docs[name] = {
            "doc": doc,
            "exported": exported,
            "normalized": json.dumps(
                exported, ensure_ascii=False, indent=2, sort_keys=True
            )
            + "\n",
            "markdown": doc.export_to_markdown().rstrip("\n") + "\n",
            "counts": {
                "texts": len(doc.texts),
                "tables": len(doc.tables),
                "pictures": len(doc.pictures),
                "groups": len(doc.groups),
                "pages": len(doc.pages),
            },
            "name": doc.name,
        }
    return docs


def _run(input_dir, out_dir, cwd=PROJECT_DIR):
    return subprocess.run(
        CMD + ["--input-dir", input_dir, "--out-dir", out_dir],
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=TIMEOUT,
    )


def _last_stdout_line(stdout):
    lines = [line for line in stdout.splitlines() if line.strip()]
    return lines[-1] if lines else ""


@pytest.fixture(scope="session")
def main_run():
    for path in (OUT_DIR, OUT_DIR_2, VALID_ONLY_DIR, VALID_ONLY_OUT, NO_JSON_DIR, NO_JSON_OUT):
        shutil.rmtree(path, ignore_errors=True)
    before = {
        name: hashlib.sha256(_read_fixture(name)).hexdigest()
        for name in sorted(os.listdir(INBOX_DIR))
    }
    result = _run("assets/inbox", "out")
    report_path = os.path.join(OUT_DIR, "audit_report.json")
    report = None
    if os.path.isfile(report_path):
        with open(report_path, "r", encoding="utf-8") as handle:
            report = json.load(handle)
    after = {
        name: hashlib.sha256(_read_fixture(name)).hexdigest()
        for name in sorted(os.listdir(INBOX_DIR))
    }
    return {"result": result, "report": report, "before": before, "after": after}


def _entries(report):
    return {entry["file"]: entry for entry in report["documents"]}


def test_main_run_exit_code_and_stdout(main_run):
    result = main_run["result"]
    assert result.returncode == 3, (
        "Auditing assets/inbox must exit with code 3 "
        f"(got {result.returncode}); stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert _last_stdout_line(result.stdout) == "AUDIT total=8 ok=3 recovered=1 failed=5", (
        "The last non-empty stdout line must be 'AUDIT total=8 ok=3 recovered=1 failed=5', "
        f"got {_last_stdout_line(result.stdout)!r}"
    )
    assert main_run["report"] is not None, (
        f"{OUT_DIR}/audit_report.json must exist and contain valid JSON after the run."
    )


def test_report_top_level_summary(main_run):
    report = main_run["report"]
    assert report is not None, "audit_report.json was not produced."
    assert sorted(report.keys()) == sorted(
        [
            "schema_version",
            "input_dir",
            "total",
            "ok",
            "recovered",
            "failed",
            "status_counts",
            "documents",
        ]
    ), f"Unexpected top-level report keys: {sorted(report.keys())}"
    assert report["schema_version"] == CURRENT_SCHEMA_VERSION, (
        f"schema_version must be {CURRENT_SCHEMA_VERSION}, got {report['schema_version']!r}"
    )
    assert report["input_dir"] == "assets/inbox", (
        f"input_dir must be 'assets/inbox', got {report['input_dir']!r}"
    )
    assert report["total"] == 8, f"total must be 8, got {report['total']!r}"
    assert report["ok"] == 3, f"ok must be 3, got {report['ok']!r}"
    assert report["recovered"] == 1, f"recovered must be 1, got {report['recovered']!r}"
    assert report["failed"] == 5, f"failed must be 5, got {report['failed']!r}"
    assert report["status_counts"] == {
        "ok": 3,
        "malformed_json": 1,
        "not_an_object": 1,
        "version_mismatch": 1,
        "schema_invalid": 2,
        "unreadable": 0,
    }, f"Unexpected status_counts: {report['status_counts']!r}"


def test_report_document_order_and_statuses(main_run):
    report = main_run["report"]
    files = [entry["file"] for entry in report["documents"]]
    assert files == EXPECTED_ORDER, (
        f"documents must list exactly {EXPECTED_ORDER} in that order, got {files}"
    )
    for entry in report["documents"]:
        assert sorted(entry.keys()) == sorted(
            [
                "file",
                "status",
                "sha256",
                "size_bytes",
                "declared_version",
                "document_version",
                "name",
                "counts",
                "stream_parity",
                "roundtrip_stable",
                "recovered",
                "normalized_path",
                "markdown_path",
                "error",
            ]
        ), f"Unexpected keys for entry {entry['file']}: {sorted(entry.keys())}"
        assert entry["status"] == EXPECTED_STATUS[entry["file"]], (
            f"{entry['file']} must be classified as {EXPECTED_STATUS[entry['file']]}, "
            f"got {entry['status']!r}"
        )


def test_recovered_flag_and_error_field(main_run):
    entries = _entries(main_run["report"])
    for name, entry in entries.items():
        expected_recovered = name == "eta_future_version.json"
        assert entry["recovered"] is expected_recovered, (
            f"{name} must have recovered={expected_recovered}, got {entry['recovered']!r}"
        )
        if entry["status"] == "ok":
            assert entry["error"] is None, (
                f"{name} is 'ok' so its error must be null, got {entry['error']!r}"
            )
        else:
            assert isinstance(entry["error"], str) and entry["error"].strip(), (
                f"{name} is {entry['status']} so its error must be a non-empty string, "
                f"got {entry['error']!r}"
            )


def test_sha256_and_size_and_untouched_inputs(main_run):
    entries = _entries(main_run["report"])
    for name, entry in entries.items():
        raw = _read_fixture(name)
        assert entry["sha256"] == hashlib.sha256(raw).hexdigest(), (
            f"sha256 for {name} does not match the file on disk."
        )
        assert entry["size_bytes"] == len(raw), (
            f"size_bytes for {name} must be {len(raw)}, got {entry['size_bytes']!r}"
        )
    assert main_run["before"] == main_run["after"], (
        "The audit must not modify any file inside the drop directory."
    )


def test_declared_and_document_versions(main_run):
    entries = _entries(main_run["report"])
    expected_declared = {
        "alpha_report.json": CURRENT_SCHEMA_VERSION,
        "beta_notes.json": CURRENT_SCHEMA_VERSION,
        "theta_bad_types.json": CURRENT_SCHEMA_VERSION,
        "gamma_legacy.json": "1.0.0",
        "eta_future_version.json": "99.0.0",
        "delta_truncated.json": None,
        "epsilon_empty_object.json": None,
        "zeta_array.json": None,
    }
    for name, expected in expected_declared.items():
        assert entries[name]["declared_version"] == expected, (
            f"declared_version for {name} must be {expected!r}, "
            f"got {entries[name]['declared_version']!r}"
        )
    for name in INGESTED_FILES:
        assert entries[name]["document_version"] == CURRENT_SCHEMA_VERSION, (
            f"document_version for {name} must be {CURRENT_SCHEMA_VERSION!r}, "
            f"got {entries[name]['document_version']!r}"
        )
    for name in REJECTED_FILES:
        assert entries[name]["document_version"] is None, (
            f"document_version for {name} must be null, "
            f"got {entries[name]['document_version']!r}"
        )


def test_ingested_entry_fields_match_docling_oracle(main_run, oracle):
    entries = _entries(main_run["report"])
    for name in INGESTED_FILES:
        entry = entries[name]
        stem = name[: -len(".json")]
        assert entry["name"] == oracle[name]["name"], (
            f"name for {name} must be {oracle[name]['name']!r}, got {entry['name']!r}"
        )
        assert entry["counts"] == oracle[name]["counts"], (
            f"counts for {name} must be {oracle[name]['counts']}, got {entry['counts']}"
        )
        assert entry["stream_parity"] is True, f"stream_parity for {name} must be true."
        assert entry["roundtrip_stable"] is True, (
            f"roundtrip_stable for {name} must be true."
        )
        assert entry["normalized_path"] == f"normalized/{stem}.json", (
            f"normalized_path for {name} must be 'normalized/{stem}.json', "
            f"got {entry['normalized_path']!r}"
        )
        assert entry["markdown_path"] == f"markdown/{stem}.md", (
            f"markdown_path for {name} must be 'markdown/{stem}.md', "
            f"got {entry['markdown_path']!r}"
        )


def test_rejected_entry_fields_are_null_or_false(main_run):
    entries = _entries(main_run["report"])
    for name in REJECTED_FILES:
        entry = entries[name]
        for key in ("name", "counts", "normalized_path", "markdown_path"):
            assert entry[key] is None, (
                f"{key} for the rejected candidate {name} must be null, got {entry[key]!r}"
            )
        for key in ("stream_parity", "roundtrip_stable", "recovered"):
            assert entry[key] is False, (
                f"{key} for the rejected candidate {name} must be false, got {entry[key]!r}"
            )


def test_normalized_artifacts_exact_content(main_run, oracle):
    normalized_dir = os.path.join(OUT_DIR, "normalized")
    assert os.path.isdir(normalized_dir), f"{normalized_dir} must exist."
    listed = sorted(os.listdir(normalized_dir))
    expected = sorted(INGESTED_FILES)
    assert listed == expected, (
        f"{normalized_dir} must contain exactly {expected}, found {listed}"
    )
    for name in INGESTED_FILES:
        path = os.path.join(normalized_dir, name)
        with open(path, "r", encoding="utf-8") as handle:
            content = handle.read()
        assert content == oracle[name]["normalized"], (
            f"{path} does not match the canonical JSON serialization "
            "(indent=2, sorted keys, non-escaped unicode, single trailing newline)."
        )
    with open(os.path.join(normalized_dir, "beta_notes.json"), "r", encoding="utf-8") as handle:
        beta = handle.read()
    for token in ("Résumé", "净收入"):
        assert token in beta, (
            f"normalized/beta_notes.json must keep {token!r} verbatim instead of escaping it."
        )


def test_markdown_artifacts_exact_content(main_run, oracle):
    markdown_dir = os.path.join(OUT_DIR, "markdown")
    assert os.path.isdir(markdown_dir), f"{markdown_dir} must exist."
    listed = sorted(os.listdir(markdown_dir))
    expected = sorted(name[: -len(".json")] + ".md" for name in INGESTED_FILES)
    assert listed == expected, (
        f"{markdown_dir} must contain exactly {expected}, found {listed}"
    )
    for name in INGESTED_FILES:
        path = os.path.join(markdown_dir, name[: -len(".json")] + ".md")
        with open(path, "r", encoding="utf-8") as handle:
            content = handle.read()
        assert content == oracle[name]["markdown"], (
            f"{path} must equal the document's Markdown export with exactly one trailing newline."
        )


def test_recovered_document_matches_alpha_and_reingests(main_run, tmp_path):
    alpha_path = os.path.join(OUT_DIR, "normalized", "alpha_report.json")
    eta_path = os.path.join(OUT_DIR, "normalized", "eta_future_version.json")
    with open(alpha_path, "rb") as handle:
        alpha = handle.read()
    with open(eta_path, "rb") as handle:
        eta = handle.read()
    assert alpha == eta, (
        "The recovered eta_future_version document must normalize to the same bytes as "
        "alpha_report, because they only differ in their declared version."
    )
    payload = json.loads(eta.decode("utf-8"))
    assert payload["version"] == CURRENT_SCHEMA_VERSION, (
        f"The recovered normalized document must declare {CURRENT_SCHEMA_VERSION}, "
        f"got {payload['version']!r}"
    )


def test_normalized_artifacts_are_reingestable(main_run, oracle, tmp_path):
    for name in INGESTED_FILES:
        path = Path(OUT_DIR) / "normalized" / name
        in_doc = InputDocument(
            path_or_stream=path,
            format=InputFormat.JSON_DOCLING,
            backend=DoclingJSONBackend,
        )
        backend = DoclingJSONBackend(in_doc=in_doc, path_or_stream=path)
        assert backend.is_valid(), (
            f"The emitted artifact normalized/{name} cannot be ingested back by Docling."
        )
        exported = backend.convert().export_to_dict()
        assert exported == oracle[name]["exported"], (
            f"Re-ingesting normalized/{name} does not reproduce the original document."
        )
        raw = path.read_bytes()
        stream_in_doc = InputDocument(
            path_or_stream=BytesIO(raw),
            format=InputFormat.JSON_DOCLING,
            backend=DoclingJSONBackend,
            filename=name,
        )
        stream_backend = DoclingJSONBackend(
            in_doc=stream_in_doc, path_or_stream=BytesIO(raw)
        )
        assert stream_backend.is_valid(), (
            f"The emitted artifact normalized/{name} cannot be ingested from a byte stream."
        )
        assert stream_backend.convert().export_to_dict() == exported, (
            f"Stream and path ingestion of normalized/{name} disagree."
        )


def test_second_run_is_byte_identical(main_run):
    shutil.rmtree(OUT_DIR_2, ignore_errors=True)
    result = _run("assets/inbox", "out2")
    assert result.returncode == 3, (
        f"The second audit run must also exit with code 3, got {result.returncode}; "
        f"stderr={result.stderr!r}"
    )
    for relative in ["audit_report.json"] + [
        os.path.join("normalized", name) for name in INGESTED_FILES
    ] + [
        os.path.join("markdown", name[: -len(".json")] + ".md") for name in INGESTED_FILES
    ]:
        first = Path(OUT_DIR) / relative
        second = Path(OUT_DIR_2) / relative
        assert second.is_file(), f"{second} must exist after the second run."
        assert first.read_bytes() == second.read_bytes(), (
            f"{relative} differs between two runs over identical inputs; "
            "the audit output must be deterministic."
        )


def test_all_valid_run_exits_zero(oracle):
    shutil.rmtree(VALID_ONLY_DIR, ignore_errors=True)
    shutil.rmtree(VALID_ONLY_OUT, ignore_errors=True)
    os.makedirs(VALID_ONLY_DIR, exist_ok=True)
    for name in OK_FILES:
        shutil.copyfile(os.path.join(INBOX_DIR, name), os.path.join(VALID_ONLY_DIR, name))
    result = _run(VALID_ONLY_DIR, VALID_ONLY_OUT)
    assert result.returncode == 0, (
        f"A drop with only valid documents must exit with code 0, got {result.returncode}; "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert _last_stdout_line(result.stdout) == "AUDIT total=3 ok=3 recovered=0 failed=0", (
        "The last non-empty stdout line must be 'AUDIT total=3 ok=3 recovered=0 failed=0', "
        f"got {_last_stdout_line(result.stdout)!r}"
    )
    report_path = os.path.join(VALID_ONLY_OUT, "audit_report.json")
    assert os.path.isfile(report_path), f"{report_path} must exist."
    with open(report_path, "r", encoding="utf-8") as handle:
        report = json.load(handle)
    assert report["input_dir"] == VALID_ONLY_DIR, (
        f"input_dir must echo the value passed on the command line, got {report['input_dir']!r}"
    )
    assert report["total"] == 3 and report["ok"] == 3 and report["failed"] == 0, (
        f"Unexpected summary for the all-valid drop: {report}"
    )
    assert report["recovered"] == 0, f"recovered must be 0, got {report['recovered']!r}"
    assert report["status_counts"] == {
        "ok": 3,
        "malformed_json": 0,
        "not_an_object": 0,
        "version_mismatch": 0,
        "schema_invalid": 0,
        "unreadable": 0,
    }, f"Unexpected status_counts for the all-valid drop: {report['status_counts']!r}"
    assert sorted(os.listdir(os.path.join(VALID_ONLY_OUT, "normalized"))) == sorted(OK_FILES), (
        "The all-valid drop must produce exactly three normalized artifacts."
    )
    assert sorted(os.listdir(os.path.join(VALID_ONLY_OUT, "markdown"))) == sorted(
        name[: -len(".json")] + ".md" for name in OK_FILES
    ), "The all-valid drop must produce exactly three markdown artifacts."
    for name in OK_FILES:
        with open(
            os.path.join(VALID_ONLY_OUT, "normalized", name), "r", encoding="utf-8"
        ) as handle:
            assert handle.read() == oracle[name]["normalized"], (
                f"normalized/{name} in the all-valid run does not match the canonical serialization."
            )


def test_drop_without_candidates_exits_five():
    shutil.rmtree(NO_JSON_DIR, ignore_errors=True)
    shutil.rmtree(NO_JSON_OUT, ignore_errors=True)
    os.makedirs(NO_JSON_DIR, exist_ok=True)
    with open(os.path.join(NO_JSON_DIR, "notes.txt"), "w", encoding="utf-8") as handle:
        handle.write("no documents here\n")
    result = _run(NO_JSON_DIR, NO_JSON_OUT)
    assert result.returncode == 5, (
        f"A drop directory without any .json candidate must exit with code 5, "
        f"got {result.returncode}; stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert result.stdout.strip() == "", (
        f"Nothing must be printed on stdout for an empty drop, got {result.stdout!r}"
    )
    assert not os.path.isfile(os.path.join(NO_JSON_OUT, "audit_report.json")), (
        "No audit_report.json may be written for an empty drop."
    )


def test_missing_drop_directory_exits_five():
    shutil.rmtree(MISSING_DIR, ignore_errors=True)
    result = _run(MISSING_DIR, NO_JSON_OUT)
    assert result.returncode == 5, (
        f"A missing --input-dir must exit with code 5, got {result.returncode}; "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert result.stdout.strip() == "", (
        f"Nothing must be printed on stdout for a missing drop, got {result.stdout!r}"
    )
