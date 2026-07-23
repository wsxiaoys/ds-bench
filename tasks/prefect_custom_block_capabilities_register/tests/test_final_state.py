import asyncio
import hashlib
import json
import os
import time

import pytest

LEDGER_FILE = "/home/user/project/ledger_store/events.log"
SUMMARY_FILE = "/home/user/project/ledger_store/summary.json"

BLOCK_TYPE_SLUG = "text-ledger"
BLOCK_DOCUMENT_NAME = "primary"
EXPECTED_FIELDS = {"storage_dir", "ledger_name", "hash_algorithm"}
EXPECTED_DATA = {
    "storage_dir": "/home/user/project/ledger_store",
    "ledger_name": "events",
    "hash_algorithm": "sha256",
}
EXPECTED_ENTRIES = ["alpha", "beta", "gamma"]


def _expected_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Prefect server state is read from the persisted SQLite database under
# PREFECT_HOME using an ephemeral in-process API. We unset PREFECT_API_URL so
# the read succeeds regardless of whether a server process is still running.
# ---------------------------------------------------------------------------

def _read_server_state():
    os.environ.pop("PREFECT_API_URL", None)
    os.environ.setdefault("PREFECT_SERVER_ALLOW_EPHEMERAL_MODE", "true")
    os.environ.setdefault("PREFECT_HOME", "/home/user/.prefect")
    # Avoid the ephemeral in-process server's background analytics/telemetry
    # write racing with any still-running server process against the same SQLite
    # database (purely cosmetic log noise; reads succeed regardless).
    os.environ.setdefault("PREFECT_SERVER_ANALYTICS_ENABLED", "false")

    from prefect.client.orchestration import get_client

    async def _inner():
        async with get_client() as client:
            block_type = await client.read_block_type_by_slug(BLOCK_TYPE_SLUG)
            schema = await client.get_most_recent_block_schema_for_block_type(
                block_type.id
            )
            document = await client.read_block_document_by_name(
                BLOCK_DOCUMENT_NAME, BLOCK_TYPE_SLUG
            )
            properties = schema.fields.get("properties", {}) if schema else {}
            return {
                "type_slug": block_type.slug,
                "field_names": set(properties.keys()),
                "doc_name": document.name,
                "doc_data": dict(document.data or {}),
                "doc_schema_id": document.block_schema_id,
            }

    last_exc = None
    for _ in range(5):
        try:
            return asyncio.run(_inner())
        except Exception as exc:  # noqa: BLE001 - retry transient DB locks
            last_exc = exc
            time.sleep(2)
    raise AssertionError(
        f"Failed to read Prefect server state from the persisted database: {last_exc}"
    )


@pytest.fixture(scope="session")
def server_state():
    return _read_server_state()


# ---------------------------------------------------------------------------
# Filesystem artifact checks (method behavior / flow output)
# ---------------------------------------------------------------------------

def test_ledger_file_exact_content():
    assert os.path.isfile(LEDGER_FILE), f"Ledger file {LEDGER_FILE} does not exist."
    with open(LEDGER_FILE, "r", encoding="utf-8") as f:
        content = f.read()
    assert content == "alpha\nbeta\ngamma\n", (
        "Ledger file content is incorrect. Expected exactly 'alpha\\nbeta\\ngamma\\n' "
        f"but got {content!r}."
    )


def test_summary_top_level_keys():
    assert os.path.isfile(SUMMARY_FILE), f"Summary file {SUMMARY_FILE} does not exist."
    with open(SUMMARY_FILE, "r", encoding="utf-8") as f:
        summary = json.load(f)
    assert isinstance(summary, dict), "summary.json must contain a JSON object."
    assert set(summary.keys()) == {
        "ledger_name",
        "hash_algorithm",
        "entry_count",
        "entries",
    }, (
        "summary.json must have exactly the keys 'ledger_name', 'hash_algorithm', "
        f"'entry_count', 'entries' but has {sorted(summary.keys())}."
    )


def test_summary_scalar_values():
    with open(SUMMARY_FILE, "r", encoding="utf-8") as f:
        summary = json.load(f)
    assert summary["ledger_name"] == "events", (
        f"summary.json ledger_name must be 'events' but is {summary['ledger_name']!r}."
    )
    assert summary["hash_algorithm"] == "sha256", (
        f"summary.json hash_algorithm must be 'sha256' but is {summary['hash_algorithm']!r}."
    )
    assert summary["entry_count"] == 3, (
        f"summary.json entry_count must be 3 but is {summary['entry_count']!r}."
    )


def test_summary_entries_structure_and_digests():
    with open(SUMMARY_FILE, "r", encoding="utf-8") as f:
        summary = json.load(f)
    entries = summary["entries"]
    assert isinstance(entries, list), "summary.json 'entries' must be a list."
    assert len(entries) == 3, (
        f"summary.json 'entries' must contain exactly 3 items but has {len(entries)}."
    )
    for idx, (item, expected_text) in enumerate(zip(entries, EXPECTED_ENTRIES)):
        assert isinstance(item, dict), f"entries[{idx}] must be a JSON object."
        assert set(item.keys()) == {"text", "digest"}, (
            f"entries[{idx}] must have exactly keys 'text' and 'digest' but has "
            f"{sorted(item.keys())}."
        )
        assert item["text"] == expected_text, (
            f"entries[{idx}] text must be {expected_text!r} but is {item['text']!r}."
        )
        expected = _expected_digest(expected_text)
        assert item["digest"] == expected, (
            f"entries[{idx}] digest for {expected_text!r} must be the sha256 hex "
            f"{expected!r} but is {item['digest']!r}."
        )


# ---------------------------------------------------------------------------
# Prefect server state checks (registered block type & saved document)
# ---------------------------------------------------------------------------

def test_block_type_registered_with_expected_fields(server_state):
    assert server_state["type_slug"] == BLOCK_TYPE_SLUG, (
        f"Registered block type slug must be {BLOCK_TYPE_SLUG!r} but is "
        f"{server_state['type_slug']!r}."
    )
    assert server_state["field_names"] == EXPECTED_FIELDS, (
        "Registered block schema must declare exactly the fields "
        f"{sorted(EXPECTED_FIELDS)} but declares {sorted(server_state['field_names'])}."
    )


def test_block_document_saved_and_loadable(server_state):
    assert server_state["doc_name"] == BLOCK_DOCUMENT_NAME, (
        f"Saved block document must be named {BLOCK_DOCUMENT_NAME!r} but is "
        f"{server_state['doc_name']!r}."
    )
    assert server_state["doc_schema_id"] is not None, (
        "Saved block document must reference a block schema (i.e. be loadable)."
    )
    assert server_state["doc_data"] == EXPECTED_DATA, (
        f"Saved block document data must equal {EXPECTED_DATA} but is "
        f"{server_state['doc_data']}."
    )
