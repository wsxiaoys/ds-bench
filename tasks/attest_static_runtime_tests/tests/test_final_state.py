import glob
import os
import re
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SRC_DIR = os.path.join(PROJECT_DIR, "src")
TESTS_DIR = os.path.join(PROJECT_DIR, "tests")
VITEST_CONFIG = os.path.join(PROJECT_DIR, "vitest.config.ts")


def _read_files(paths: list[str]) -> str:
    blobs: list[str] = []
    for path in paths:
        with open(path, encoding="utf-8") as f:
            blobs.append(f.read())
    return "\n\n".join(blobs)


def _list_ts(directory: str, suffixes: tuple[str, ...]) -> list[str]:
    out: list[str] = []
    if not os.path.isdir(directory):
        return out
    for entry in sorted(glob.glob(os.path.join(directory, "**", "*"), recursive=True)):
        if os.path.isfile(entry) and entry.endswith(suffixes):
            out.append(entry)
    return out


# ---------------------------------------------------------------------------
# Behavioural test (vitest must pass)
# ---------------------------------------------------------------------------


def test_npm_test_exits_zero_and_passes():
    """Acceptance: `npm test` exits 0 and vitest reports a passing run."""
    # Clean any cached attest snapshots before running.
    attest_cache = os.path.join(PROJECT_DIR, ".attest")
    if os.path.isdir(attest_cache):
        shutil.rmtree(attest_cache, ignore_errors=True)

    result = subprocess.run(
        ["npm", "test", "--silent"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    assert result.returncode == 0, (
        f"`npm test` exited with non-zero status {result.returncode}.\n"
        f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
    )
    # vitest passing summary commonly looks like "Tests  N passed (N)" / "Test Files ... passed".
    assert re.search(r"\bpassed\b", combined, re.IGNORECASE), (
        f"vitest output did not contain a 'passed' summary.\n"
        f"Combined output:\n{combined}"
    )
    # Reject any "X failed" with a non-zero count.
    failed_match = re.search(r"(\d+)\s+failed\b", combined, re.IGNORECASE)
    if failed_match:
        assert int(failed_match.group(1)) == 0, (
            f"vitest reported {failed_match.group(1)} failed tests.\n"
            f"Combined output:\n{combined}"
        )


# ---------------------------------------------------------------------------
# Schema file structural checks
# ---------------------------------------------------------------------------


def test_schema_src_files_exist():
    files = _list_ts(SRC_DIR, (".ts",))
    assert files, (
        f"Expected at least one TypeScript schema source under {SRC_DIR}."
    )


def test_schema_imports_arktype():
    files = _list_ts(SRC_DIR, (".ts",))
    assert files, f"No TypeScript sources under {SRC_DIR}."
    source = _read_files(files)
    assert re.search(r"from\s+['\"]arktype['\"]", source), (
        "Schema source must import from 'arktype'."
    )


def test_schema_defines_at_least_four_named_exports():
    files = _list_ts(SRC_DIR, (".ts",))
    assert files, f"No TypeScript sources under {SRC_DIR}."
    source = _read_files(files)
    pattern = re.compile(
        r"export\s+(?:async\s+)?(?:const|let|var|function)\s+"
        r"([A-Za-z_$][A-Za-z0-9_$]*)\b"
    )
    names = set(pattern.findall(source))
    assert len(names) >= 4, (
        f"Schema source(s) must define at least 4 distinct named exports, "
        f"found {len(names)}: {sorted(names)}"
    )


def test_schema_uses_scope_export():
    files = _list_ts(SRC_DIR, (".ts",))
    source = _read_files(files)
    assert re.search(
        r"scope\s*\([\s\S]+?\)\s*\.\s*export\s*\(\s*\)", source
    ), (
        "Schema source must build at least one type via `scope({...}).export()`."
    )


def test_schema_uses_morph_operator():
    files = _list_ts(SRC_DIR, (".ts",))
    source = _read_files(files)
    # ArkType's morph operators are the string tokens "|>" or "=>" inside an
    # ArkType definition string. Accept either token surrounded by optional
    # whitespace inside any string literal.
    assert re.search(r"['\"]\s*(?:\|>|=>)\s*['\"]", source), (
        "Schema source must use an ArkType morph operator "
        '(e.g. "|>" or "=>" in a tuple/pipe expression).'
    )


# ---------------------------------------------------------------------------
# Test file structural checks
# ---------------------------------------------------------------------------


def _read_test_sources() -> str:
    files = _list_ts(TESTS_DIR, (".test.ts", ".spec.ts"))
    assert files, (
        f"Expected at least one *.test.ts / *.spec.ts file under {TESTS_DIR}."
    )
    return _read_files(files)


def test_test_file_imports_attest():
    source = _read_test_sources()
    assert re.search(r"from\s+['\"]@arktype/attest['\"]", source), (
        "Test file(s) must import from '@arktype/attest'."
    )


def test_test_file_has_at_least_8_attest_calls():
    source = _read_test_sources()
    # Count occurrences of the raw token `attest(` or `attest<...>(`. We use a
    # generous regex that matches both forms.
    matches = re.findall(r"\battest\s*(?:<[^>]+>)?\s*\(", source)
    assert len(matches) >= 8, (
        f"Test file(s) must contain at least 8 attest(...) calls, found "
        f"{len(matches)}."
    )


def test_test_file_has_type_argument_attest():
    source = _read_test_sources()
    assert re.search(r"\battest\s*<[^>]+>\s*\(", source), (
        "Test file(s) must contain at least one `attest<T>(...)` "
        "type-argument call for a compile-time type-equality check."
    )


def test_test_file_uses_throws_on_thunk():
    source = _read_test_sources()
    # Match `.throws(` but NOT `.throwsAndHasTypeError(`.
    assert re.search(r"\.throws\s*\((?!AndHasTypeError)", source), (
        "Test file(s) must contain at least one `.throws(...)` assertion on "
        "a thunk (in addition to any `.throwsAndHasTypeError(...)`)."
    )


def test_test_file_uses_throws_and_has_type_error():
    source = _read_test_sources()
    assert ".throwsAndHasTypeError(" in source, (
        "Test file(s) must contain at least one `.throwsAndHasTypeError(...)` "
        "assertion."
    )


def test_test_file_uses_completions():
    source = _read_test_sources()
    assert ".completions(" in source, (
        "Test file(s) must contain at least one `.completions({...})` "
        "assertion."
    )


def test_test_file_uses_type_to_string_snap_or_equals():
    source = _read_test_sources()
    assert (
        ".type.toString.snap(" in source
        or ".type.toString.equals(" in source
    ), (
        "Test file(s) must contain at least one "
        "`.type.toString.snap(...)` or `.type.toString.equals(...)` call."
    )


def test_test_file_has_ts_expect_error_directive():
    source = _read_test_sources()
    assert "// @ts-expect-error" in source, (
        "Test file(s) must contain at least one `// @ts-expect-error` "
        "directive guarding a deliberately-broken assertion."
    )


# ---------------------------------------------------------------------------
# Vitest configuration checks
# ---------------------------------------------------------------------------


def test_vitest_config_exists():
    assert os.path.isfile(VITEST_CONFIG), (
        f"vitest.config.ts not found at {VITEST_CONFIG}."
    )


def test_vitest_config_registers_global_setup_for_attest():
    with open(VITEST_CONFIG, encoding="utf-8") as f:
        config_source = f.read()
    assert re.search(r"globalSetup\s*:", config_source), (
        "vitest.config.ts must register a `globalSetup` entry."
    )

    # Find any referenced setup file path inside the globalSetup value and
    # verify at least one such file calls attest's setup().
    referenced = re.findall(
        r"globalSetup\s*:\s*\[?\s*['\"]([^'\"]+)['\"]", config_source
    )
    candidate_paths: list[str] = []
    for ref in referenced:
        # Strip leading ./ and resolve relative to PROJECT_DIR.
        normalized = ref.lstrip("./")
        # Try as-is and with .ts extension.
        for candidate in (
            os.path.join(PROJECT_DIR, normalized),
            os.path.join(PROJECT_DIR, normalized + ".ts"),
        ):
            if os.path.isfile(candidate):
                candidate_paths.append(candidate)
                break

    # Fallback: also scan common setup filenames at the project root.
    for fallback in (
        "setupVitest.ts",
        "setup.vitest.ts",
        "vitest.setup.ts",
        "attest.setup.ts",
    ):
        candidate = os.path.join(PROJECT_DIR, fallback)
        if os.path.isfile(candidate) and candidate not in candidate_paths:
            candidate_paths.append(candidate)

    assert candidate_paths, (
        "Could not locate a globalSetup file referenced by vitest.config.ts."
    )

    found = False
    for path in candidate_paths:
        with open(path, encoding="utf-8") as f:
            setup_source = f.read()
        if re.search(
            r"from\s+['\"]@arktype/attest['\"]", setup_source
        ) and re.search(r"\bsetup\s*\(", setup_source):
            found = True
            break

    assert found, (
        "vitest globalSetup file(s) must import `setup` from "
        "'@arktype/attest' and call `setup(...)`."
    )
