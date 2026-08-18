import hashlib
import json
import os

PROJECT_DIR = "/home/user/project"
INBOX_DIR = os.path.join(PROJECT_DIR, "assets", "inbox")

EXPECTED_FILES = [
    "alpha_report.json",
    "beta_notes.json",
    "delta_truncated.json",
    "epsilon_empty_object.json",
    "eta_future_version.json",
    "gamma_legacy.json",
    "readme.txt",
    "theta_bad_types.json",
    "zeta_array.json",
]


def _read_bytes(name: str) -> bytes:
    path = os.path.join(INBOX_DIR, name)
    assert os.path.isfile(path), f"Fixture file {path} does not exist."
    with open(path, "rb") as handle:
        return handle.read()


def test_docling_library_importable():
    import docling  # noqa: F401
    import docling_core  # noqa: F401
    from docling.backend.json.docling_json_backend import (  # noqa: F401
        DoclingJSONBackend,
    )
    from docling_core.types.doc import DoclingDocument  # noqa: F401

    assert DoclingDocument(name="probe").version, (
        "The installed docling-core does not report a DoclingDocument schema version."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_inbox_directory_exists():
    assert os.path.isdir(INBOX_DIR), f"Drop directory {INBOX_DIR} does not exist."


def test_inbox_contains_exactly_the_expected_fixtures():
    entries = sorted(os.listdir(INBOX_DIR))
    assert entries == EXPECTED_FILES, (
        f"Drop directory {INBOX_DIR} must contain exactly {EXPECTED_FILES}, found {entries}."
    )


def test_valid_fixtures_are_ingestable_docling_documents():
    from docling_core.types.doc import DoclingDocument

    current_version = DoclingDocument(name="probe").version
    for name in ("alpha_report.json", "beta_notes.json"):
        payload = json.loads(_read_bytes(name).decode("utf-8"))
        assert payload.get("version") == current_version, (
            f"Fixture {name} must declare the current schema version {current_version}."
        )
        doc = DoclingDocument.model_validate(payload)
        assert doc.name, f"Fixture {name} must ingest into a named DoclingDocument."


def test_beta_notes_contains_non_ascii_text():
    raw = _read_bytes("beta_notes.json").decode("utf-8")
    for token in ("Résumé", "净收入", "→"):
        assert token in raw, f"Fixture beta_notes.json must contain the text {token!r}."


def test_gamma_legacy_declares_older_schema_version():
    payload = json.loads(_read_bytes("gamma_legacy.json").decode("utf-8"))
    assert payload.get("version") == "1.0.0", (
        "Fixture gamma_legacy.json must declare version 1.0.0."
    )


def test_eta_future_version_declares_incompatible_version():
    payload = json.loads(_read_bytes("eta_future_version.json").decode("utf-8"))
    assert payload.get("version") == "99.0.0", (
        "Fixture eta_future_version.json must declare version 99.0.0."
    )


def test_delta_truncated_is_not_parseable_json():
    raw = _read_bytes("delta_truncated.json")
    assert len(raw) == 400, "Fixture delta_truncated.json must be 400 bytes long."
    try:
        json.loads(raw.decode("utf-8"))
    except Exception:
        return
    raise AssertionError("Fixture delta_truncated.json must not parse as JSON.")


def test_epsilon_empty_object_fixture():
    assert _read_bytes("epsilon_empty_object.json") == b"{}", (
        "Fixture epsilon_empty_object.json must contain exactly the bytes '{}'."
    )


def test_zeta_array_fixture_is_a_json_array():
    payload = json.loads(_read_bytes("zeta_array.json").decode("utf-8"))
    assert isinstance(payload, list), (
        "Fixture zeta_array.json must hold a top-level JSON array."
    )


def test_theta_bad_types_fixture_has_invalid_texts_member():
    payload = json.loads(_read_bytes("theta_bad_types.json").decode("utf-8"))
    assert payload.get("texts") == "not-a-list", (
        "Fixture theta_bad_types.json must set the top-level 'texts' member to 'not-a-list'."
    )


def test_readme_is_plain_text():
    raw = _read_bytes("readme.txt")
    assert len(raw) > 0, "Fixture readme.txt must not be empty."


def test_fixture_payloads_share_expected_relationships():
    alpha = _read_bytes("alpha_report.json")
    delta = _read_bytes("delta_truncated.json")
    assert alpha.startswith(delta), (
        "Fixture delta_truncated.json must be a prefix of alpha_report.json."
    )
    eta = json.loads(_read_bytes("eta_future_version.json").decode("utf-8"))
    alpha_payload = json.loads(alpha.decode("utf-8"))
    eta_normalized = dict(eta)
    eta_normalized["version"] = alpha_payload["version"]
    assert eta_normalized == alpha_payload, (
        "Fixture eta_future_version.json must equal alpha_report.json apart from its version member."
    )
    beta_payload = json.loads(_read_bytes("beta_notes.json").decode("utf-8"))
    gamma_payload = json.loads(_read_bytes("gamma_legacy.json").decode("utf-8"))
    gamma_payload["version"] = beta_payload["version"]
    assert gamma_payload == beta_payload, (
        "Fixture gamma_legacy.json must equal beta_notes.json apart from its version member."
    )
    assert hashlib.sha256(alpha).hexdigest() != hashlib.sha256(
        _read_bytes("beta_notes.json")
    ).hexdigest(), "alpha_report.json and beta_notes.json must differ."


def test_solution_artifacts_are_absent():
    for relative in ("docaudit", "out", "out2"):
        path = os.path.join(PROJECT_DIR, relative)
        assert not os.path.exists(path), (
            f"{path} must not exist before the task is solved."
        )
