import json
import os
import subprocess

PROJECT_DIR = "/home/user/myproject"
CLI_PATH = os.path.join(PROJECT_DIR, "cli.ts")
ENV_PATH = os.path.join(PROJECT_DIR, ".env")
PACKAGE_JSON_PATH = os.path.join(PROJECT_DIR, "package.json")

VALID_ENV = {
    "PORT": "8080",
    "DATABASE_URL": "postgres://user:pw@db.example.com:5432/app",
    "ALLOWED_ORIGINS": "https://a.example.com,https://b.example.com",
    "LOG_LEVEL": "info",
}

MANAGED_KEYS = ("PORT", "DATABASE_URL", "ALLOWED_ORIGINS", "LOG_LEVEL")


def _write_env(values: dict[str, str]) -> None:
    """Write a .env file at the project root from a key->value dict."""
    lines = [f"{k}={v}\n" for k, v in values.items()]
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)


def _clean_subprocess_env() -> dict[str, str]:
    """Return an env dict suitable for subprocess that strips the schema vars."""
    env = os.environ.copy()
    for k in MANAGED_KEYS:
        env.pop(k, None)
    return env


def _run_cli() -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["npx", "--no-install", "tsx", "cli.ts"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        env=_clean_subprocess_env(),
        timeout=120,
    )


def _stdout_lines(stdout: str) -> list[str]:
    return [line for line in stdout.splitlines() if line.strip() != ""]


def _assert_invalid(case_name: str, env_values: dict[str, str]) -> None:
    _write_env(env_values)
    result = _run_cli()
    assert result.returncode == 0, (
        f"[{case_name}] CLI exited with non-zero code: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )
    lines = _stdout_lines(result.stdout)
    assert len(lines) == 1, (
        f"[{case_name}] Expected exactly one non-empty stdout line for invalid "
        f"input, got: {lines!r} (stderr={result.stderr!r})"
    )
    assert lines[0].startswith("INVALID:"), (
        f"[{case_name}] Expected the only stdout line to start with 'INVALID:', "
        f"got: {lines[0]!r}"
    )


# ---------------------------------------------------------------------------
# Sanity: CLI entrypoint exists
# ---------------------------------------------------------------------------


def test_cli_entrypoint_exists():
    assert os.path.isfile(CLI_PATH), (
        f"Expected CLI entrypoint at {CLI_PATH}."
    )


# ---------------------------------------------------------------------------
# Criterion 1: All-valid .env -> VALID + JSON
# ---------------------------------------------------------------------------


def test_valid_env_is_accepted_and_returned_as_json():
    _write_env(VALID_ENV)
    result = _run_cli()
    assert result.returncode == 0, (
        f"CLI exited with non-zero code for a valid .env: "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}"
    )

    lines = _stdout_lines(result.stdout)
    assert lines and lines[0] == "VALID", (
        f"Expected first non-empty stdout line to be 'VALID', got: {lines!r} "
        f"(stderr={result.stderr!r})"
    )
    assert len(lines) >= 2, (
        f"Expected validated JSON env on the line after VALID, got: {lines!r}"
    )

    try:
        validated = json.loads(lines[1])
    except json.JSONDecodeError as exc:
        raise AssertionError(
            f"Second stdout line is not valid JSON: {lines[1]!r} (error: {exc})"
        )

    assert validated.get("PORT") == 8080, (
        f"Expected validated PORT to be number 8080, got: {validated!r}"
    )
    assert isinstance(validated.get("PORT"), int) and not isinstance(
        validated.get("PORT"), bool
    ), (
        f"Expected validated PORT to be a JSON number, got type "
        f"{type(validated.get('PORT')).__name__}: {validated!r}"
    )
    assert validated.get("DATABASE_URL") == (
        "postgres://user:pw@db.example.com:5432/app"
    ), f"DATABASE_URL mismatch in validated env: {validated!r}"
    assert validated.get("ALLOWED_ORIGINS") == [
        "https://a.example.com",
        "https://b.example.com",
    ], f"ALLOWED_ORIGINS mismatch in validated env: {validated!r}"
    assert validated.get("LOG_LEVEL") == "info", (
        f"LOG_LEVEL mismatch in validated env: {validated!r}"
    )


# ---------------------------------------------------------------------------
# Criterion 2: PORT below range -> INVALID
# ---------------------------------------------------------------------------


def test_port_below_range_is_rejected():
    bad = dict(VALID_ENV)
    bad["PORT"] = "80"
    _assert_invalid("PORT below 1024", bad)


# ---------------------------------------------------------------------------
# Criterion 3: PORT above range -> INVALID
# ---------------------------------------------------------------------------


def test_port_above_range_is_rejected():
    bad = dict(VALID_ENV)
    bad["PORT"] = "70000"
    _assert_invalid("PORT above 65535", bad)


# ---------------------------------------------------------------------------
# Criterion 4: PORT not an integer -> INVALID
# ---------------------------------------------------------------------------


def test_port_non_integer_is_rejected():
    bad = dict(VALID_ENV)
    bad["PORT"] = "8080.5"
    _assert_invalid("PORT is not an integer", bad)


# ---------------------------------------------------------------------------
# Criterion 5: Bad DATABASE_URL -> INVALID
# ---------------------------------------------------------------------------


def test_bad_database_url_is_rejected():
    bad = dict(VALID_ENV)
    bad["DATABASE_URL"] = "not-a-url"
    _assert_invalid("DATABASE_URL is not a URL", bad)


# ---------------------------------------------------------------------------
# Criterion 6: ALLOWED_ORIGINS contains a non-URL element -> INVALID
# ---------------------------------------------------------------------------


def test_allowed_origins_with_non_url_element_is_rejected():
    bad = dict(VALID_ENV)
    bad["ALLOWED_ORIGINS"] = "https://a.example.com,bogus"
    _assert_invalid("ALLOWED_ORIGINS has a non-URL element", bad)


# ---------------------------------------------------------------------------
# Criterion 7: Empty ALLOWED_ORIGINS -> INVALID
# ---------------------------------------------------------------------------


def test_empty_allowed_origins_is_rejected():
    bad = dict(VALID_ENV)
    bad["ALLOWED_ORIGINS"] = ""
    _assert_invalid("ALLOWED_ORIGINS is empty", bad)


# ---------------------------------------------------------------------------
# Criterion 8: Bad LOG_LEVEL -> INVALID
# ---------------------------------------------------------------------------


def test_bad_log_level_is_rejected():
    bad = dict(VALID_ENV)
    bad["LOG_LEVEL"] = "verbose"
    _assert_invalid("LOG_LEVEL not in allowed set", bad)


# ---------------------------------------------------------------------------
# Criterion 9: Missing variable -> INVALID
# ---------------------------------------------------------------------------


def test_missing_port_is_rejected():
    bad = {k: v for k, v in VALID_ENV.items() if k != "PORT"}
    _assert_invalid("PORT key missing from .env", bad)


# ---------------------------------------------------------------------------
# Criterion 10: package.json pins the required versions
# ---------------------------------------------------------------------------


def test_package_json_pins_required_versions():
    assert os.path.isfile(PACKAGE_JSON_PATH), (
        f"Expected package.json at {PACKAGE_JSON_PATH}."
    )
    with open(PACKAGE_JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)
    deps = data.get("dependencies", {})
    assert deps.get("arktype") == "2.2.0", (
        f"Expected dependencies.arktype to be pinned to '2.2.0', got: "
        f"{deps.get('arktype')!r}"
    )
    assert deps.get("arkenv") == "0.12.1", (
        f"Expected dependencies.arkenv to be pinned to '0.12.1', got: "
        f"{deps.get('arkenv')!r}"
    )
