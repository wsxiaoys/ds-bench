import os
import re
import subprocess


PROJECT_DIR = "/home/user/myproject"

# Vitest config can be ts/js/mts/mjs/cjs.
_VITEST_CONFIG_CANDIDATES = (
    "vitest.config.ts",
    "vitest.config.mts",
    "vitest.config.cts",
    "vitest.config.js",
    "vitest.config.mjs",
    "vitest.config.cjs",
)


def _find_vitest_config() -> str:
    for name in _VITEST_CONFIG_CANDIDATES:
        candidate = os.path.join(PROJECT_DIR, name)
        if os.path.isfile(candidate):
            return candidate
    raise AssertionError(
        f"No vitest config file found in {PROJECT_DIR}. "
        f"Expected one of: {', '.join(_VITEST_CONFIG_CANDIDATES)}."
    )


def _iter_test_source_files():
    """Yield (path, content) for files under the project that could plausibly hold tests/configs.

    Excludes node_modules and dot directories.
    """
    skip_dirs = {"node_modules", ".git", ".attest", "dist", "build", ".vitest"}
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith(".")]
        for fname in files:
            if not fname.endswith((".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs")):
                continue
            full = os.path.join(root, fname)
            try:
                with open(full, "r", encoding="utf-8") as f:
                    yield full, f.read()
            except (OSError, UnicodeDecodeError):
                continue


def _strip_comments_and_normalize(src: str) -> str:
    # Remove /* ... */ block comments
    src = re.sub(r"/\*.*?\*/", " ", src, flags=re.DOTALL)
    # Remove // line comments
    src = re.sub(r"//[^\n]*", " ", src)
    # Collapse all whitespace to single spaces
    return re.sub(r"\s+", " ", src)


def test_vitest_config_registers_attest_setup():
    """vitest.config.* must register a globalSetup that wires in @arktype/attest setup()."""
    config_path = _find_vitest_config()
    with open(config_path, "r", encoding="utf-8") as f:
        config_src = f.read()

    normalized_cfg = _strip_comments_and_normalize(config_src)

    # globalSetup must be present and reference a setup file.
    global_setup_match = re.search(
        r"globalSetup\s*:\s*(\[[^\]]+\]|['\"][^'\"]+['\"])",
        normalized_cfg,
    )
    assert global_setup_match, (
        f"{config_path} must define `test.globalSetup` referencing a setup file. "
        f"Content (normalized): {normalized_cfg!r}"
    )

    raw_value = global_setup_match.group(1)
    referenced_files = re.findall(r"['\"]([^'\"]+)['\"]", raw_value)
    assert referenced_files, (
        f"`test.globalSetup` in {config_path} must reference at least one file path. "
        f"Got: {raw_value!r}"
    )

    # Resolve referenced setup files relative to project dir.
    project_setup_sources = []
    config_dir = os.path.dirname(config_path)
    for ref in referenced_files:
        ref_path = ref
        if ref_path.startswith("./") or ref_path.startswith("../"):
            ref_path = os.path.normpath(os.path.join(config_dir, ref_path))
        elif not os.path.isabs(ref_path):
            ref_path = os.path.normpath(os.path.join(config_dir, ref_path))

        # Try the referenced path plus common TS/JS extensions.
        candidate_paths = [ref_path] + [
            ref_path + ext for ext in (".ts", ".mts", ".cts", ".js", ".mjs", ".cjs")
        ]
        resolved = next((p for p in candidate_paths if os.path.isfile(p)), None)
        assert resolved is not None, (
            f"globalSetup references {ref!r} but no matching file was found "
            f"(tried: {candidate_paths})."
        )
        with open(resolved, "r", encoding="utf-8") as f:
            project_setup_sources.append((resolved, f.read()))

    # At least one setup file must import setup from @arktype/attest and call it.
    attest_setup_found = False
    for path, src in project_setup_sources:
        normalized = _strip_comments_and_normalize(src)
        imports_attest = bool(
            re.search(
                r"(?:from\s+['\"]@arktype/attest['\"])|"
                r"(?:require\(\s*['\"]@arktype/attest['\"]\s*\))",
                normalized,
            )
        )
        calls_setup = bool(re.search(r"\bsetup\s*\(", normalized))
        if imports_attest and calls_setup:
            attest_setup_found = True
            break

    assert attest_setup_found, (
        "Expected at least one globalSetup file to import from '@arktype/attest' "
        f"and call setup(). Searched: {[p for p, _ in project_setup_sources]}."
    )


def test_attest_number_assertion_against_string_numeric_parse():
    """Some test file must contain `attest<number>(...)` against a `string.numeric.parse` schema's .infer."""
    found = False
    for path, src in _iter_test_source_files():
        if "node_modules" in path:
            continue
        normalized = _strip_comments_and_normalize(src)

        if "string.numeric.parse" not in normalized:
            continue
        # Look for an attest<number>(...) call with .infer inside.
        # Allow any whitespace, generic spelling, and arbitrary expression up to a matching ')'.
        pattern = re.compile(
            r"attest\s*<\s*number\s*>\s*\([^)]*\.infer[^)]*\)"
        )
        if pattern.search(normalized):
            found = True
            break

    assert found, (
        "Expected at least one test file to contain a `string.numeric.parse` schema "
        "and an `attest<number>(<schema>.infer)` assertion against it."
    )


def test_throws_and_has_type_error_on_number_mod_zero():
    """Some test file must contain the throwsAndHasTypeError assertion with the exact expected message."""
    expected_message = '"% operator must be followed by a non-zero integer literal (was 0)"'
    found = False
    for path, src in _iter_test_source_files():
        if "node_modules" in path:
            continue
        normalized = _strip_comments_and_normalize(src)

        # Look for: attest(() => type("number%0")).throwsAndHasTypeError("...exact text...")
        # Allow either single or double quotes for the type string and message.
        pattern = re.compile(
            r"attest\s*\(\s*\(\s*\)\s*=>\s*type\s*\(\s*[\"']number%0[\"']\s*\)\s*\)"
            r"\s*\.\s*throwsAndHasTypeError\s*\(\s*"
            r"""(?P<msg>[\"'])% operator must be followed by a non-zero integer literal \(was 0\)(?P=msg)"""
        )
        if pattern.search(normalized):
            found = True
            break

    assert found, (
        "Expected at least one test file to contain "
        "`attest(() => type(\"number%0\")).throwsAndHasTypeError("
        f"{expected_message})`."
    )


def test_vitest_run_exits_zero_and_all_tests_pass():
    """`npx vitest run` must exit 0 and report no failing tests."""
    result = subprocess.run(
        ["npx", "--no", "vitest", "run", "--reporter=default"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    combined = result.stdout + "\n" + result.stderr
    assert result.returncode == 0, (
        f"`npx vitest run` failed with exit code {result.returncode}.\n"
        f"--- STDOUT ---\n{result.stdout}\n--- STDERR ---\n{result.stderr}"
    )

    # Make sure a Vitest summary indicates at least one test ran.
    assert re.search(r"Test Files\s+\d+\s+passed", combined) or re.search(
        r"Tests\s+\d+\s+passed", combined
    ), (
        "Could not find a Vitest pass summary in the output. "
        f"Output was:\n--- STDOUT ---\n{result.stdout}\n--- STDERR ---\n{result.stderr}"
    )

    # No failing tests should be reported.
    assert not re.search(r"\b\d+\s+failed", combined), (
        "Vitest reported failing tests.\n"
        f"--- STDOUT ---\n{result.stdout}\n--- STDERR ---\n{result.stderr}"
    )
