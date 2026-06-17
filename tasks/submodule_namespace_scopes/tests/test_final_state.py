import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "src", "schema.ts")
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")

USER_UUID = "11111111-1111-4111-8111-111111111111"
ORG_UUID = "22222222-2222-4222-8222-222222222222"
ADMIN_UUID = "33333333-3333-4333-8333-333333333333"
VALID_TOKEN = "a" * 64


def _run_cli(payload: dict | list) -> subprocess.CompletedProcess[str]:
    """Invoke the CLI by piping a JSON payload through stdin."""
    return subprocess.run(
        ["npx", "--no-install", "tsx", "cli.ts"],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=120,
    )


def _stdout_lines(stdout: str) -> list[str]:
    return [line for line in stdout.splitlines() if line.strip() != ""]


# ---------------------------------------------------------------------------
# Behavioural tests (Criteria 1-5)
# ---------------------------------------------------------------------------


def test_valid_create_user_accepted():
    """Criterion 1: a valid createUser envelope validates successfully."""
    payload = {
        "kind": "createUser",
        "payload": {
            "user": {
                "id": USER_UUID,
                "name": "alice",
                "orgId": ORG_UUID,
            },
            "token": VALID_TOKEN,
        },
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid createUser request: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected validated JSON payload on the line after VALID, got: {lines!r}"
    )

    try:
        validated = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )

    user = validated.get("user", {})
    assert user.get("id") == USER_UUID, (
        f"Validated user.id mismatch: {validated!r}"
    )
    assert user.get("name") == "alice", (
        f"Validated user.name mismatch: {validated!r}"
    )
    assert user.get("orgId") == ORG_UUID, (
        f"Validated user.orgId mismatch: {validated!r}"
    )
    assert validated.get("token") == VALID_TOKEN, (
        f"Validated token mismatch: {validated!r}"
    )


def test_valid_create_org_accepted():
    """Criterion 2: a valid createOrg envelope validates successfully."""
    payload = {
        "kind": "createOrg",
        "payload": {
            "org": {
                "id": ORG_UUID,
                "name": "Acme Corp",
            },
            "adminUserId": ADMIN_UUID,
        },
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid createOrg request: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected validated JSON payload on the line after VALID, got: {lines!r}"
    )

    try:
        validated = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )

    org = validated.get("org", {})
    assert org.get("id") == ORG_UUID, (
        f"Validated org.id mismatch: {validated!r}"
    )
    assert org.get("name") == "Acme Corp", (
        f"Validated org.name mismatch: {validated!r}"
    )
    assert validated.get("adminUserId") == ADMIN_UUID, (
        f"Validated adminUserId mismatch: {validated!r}"
    )


def test_create_user_bad_token_length_rejected():
    """Criterion 3: createUser with a token shorter than 32 chars is rejected."""
    payload = {
        "kind": "createUser",
        "payload": {
            "user": {
                "id": USER_UUID,
                "name": "alice",
                "orgId": ORG_UUID,
            },
            "token": "short",
        },
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for short token, got: "
        f"{result.stdout!r}"
    )


def test_create_user_bad_uuid_orgId_rejected():
    """Criterion 4: createUser with a non-UUID orgId is rejected."""
    payload = {
        "kind": "createUser",
        "payload": {
            "user": {
                "id": USER_UUID,
                "name": "alice",
                "orgId": "not-a-uuid",
            },
            "token": VALID_TOKEN,
        },
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for bad orgId, got: "
        f"{result.stdout!r}"
    )


def test_create_org_bad_org_name_length_rejected():
    """Criterion 5: createOrg with an empty org.name is rejected."""
    payload = {
        "kind": "createOrg",
        "payload": {
            "org": {
                "id": ORG_UUID,
                "name": "",
            },
            "adminUserId": ADMIN_UUID,
        },
    }

    result = _run_cli(payload)
    assert result.returncode == 0, (
        f"CLI exited with non-zero code: stdout={result.stdout!r}, "
        f"stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert lines and lines[0].startswith("INVALID:"), (
        f"Expected stdout to start with 'INVALID:' for empty org.name, got: "
        f"{result.stdout!r}"
    )


# ---------------------------------------------------------------------------
# Implementation-shape tests (Criterion 6)
# ---------------------------------------------------------------------------


def _read_schema_source() -> str:
    assert os.path.isfile(SCHEMA_PATH), (
        f"Expected schema module at {SCHEMA_PATH}."
    )
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        return f.read()


def test_cli_entrypoint_exists():
    """Sanity: the CLI entrypoint required by the acceptance criteria exists."""
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )


def test_schema_imports_scope_from_arktype():
    """Criterion 6: src/schema.ts imports `scope` from 'arktype'."""
    source = _read_schema_source()
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "src/schema.ts must import from 'arktype'."
    )
    assert re.search(r"\bscope\b", source), (
        "src/schema.ts must use ArkType's `scope` to build the namespaced module."
    )


def test_schema_uses_single_scope_call():
    """Criterion 6: there is exactly ONE top-level `scope(` invocation."""
    source = _read_schema_source()
    matches = re.findall(r"\bscope\s*\(", source)
    assert len(matches) == 1, (
        "src/schema.ts must contain exactly one `scope(` call so that the db.* "
        f"and api.* aliases share a single scope; found {len(matches)}."
    )
    assert re.search(r"scope\s*\([\s\S]+?\)\s*\.\s*export\s*\(\s*\)", source), (
        "src/schema.ts must build the module via `scope({...}).export()`."
    )


def test_schema_defines_db_user_key():
    """Criterion 6: `db.User` appears as a quoted property key in the scope call."""
    source = _read_schema_source()
    assert re.search(r"['\"]db\.User['\"]\s*:", source), (
        "src/schema.ts must define a `db.User` submodule key (e.g. \"db.User\": {...})."
    )


def test_schema_defines_db_org_key():
    """Criterion 6: `db.Org` appears as a quoted property key in the scope call."""
    source = _read_schema_source()
    assert re.search(r"['\"]db\.Org['\"]\s*:", source), (
        "src/schema.ts must define a `db.Org` submodule key (e.g. \"db.Org\": {...})."
    )


def test_schema_defines_api_create_user_request_key():
    """Criterion 6: `api.CreateUserRequest` appears as a quoted property key."""
    source = _read_schema_source()
    assert re.search(r"['\"]api\.CreateUserRequest['\"]\s*:", source), (
        "src/schema.ts must define an `api.CreateUserRequest` submodule key."
    )


def test_schema_defines_api_create_org_request_key():
    """Criterion 6: `api.CreateOrgRequest` appears as a quoted property key."""
    source = _read_schema_source()
    assert re.search(r"['\"]api\.CreateOrgRequest['\"]\s*:", source), (
        "src/schema.ts must define an `api.CreateOrgRequest` submodule key."
    )


def test_schema_api_references_db_user_by_string_alias():
    """Criterion 6: the api.* types reference db.User by string alias.

    This guards against the executor inlining the db.User object shape inside
    api.CreateUserRequest instead of using the submodule reference.
    """
    source = _read_schema_source()
    # The substring "db.User" must appear at least twice in the source:
    # once as the submodule definition key and at least once again as a
    # string-embedded reference from api.CreateUserRequest.
    occurrences = len(re.findall(r"['\"]db\.User['\"]", source))
    assert occurrences >= 2, (
        "src/schema.ts must reference `db.User` from api.CreateUserRequest by "
        "string alias (e.g. `user: \"db.User\"`) instead of inlining the object "
        f"shape. Found {occurrences} occurrence(s) of `\"db.User\"`."
    )
