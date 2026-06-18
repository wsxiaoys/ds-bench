import json
import os
import re
import subprocess

PROJECT_DIR = "/home/user/myproject"
CONVERT_JS = os.path.join(PROJECT_DIR, "convert.js")


def _run_convert(stdin_payload: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", "convert.js"],
        input=stdin_payload,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=60,
    )


def test_arktype_pinned_to_2_2_0():
    pkg_json_path = os.path.join(PROJECT_DIR, "node_modules", "arktype", "package.json")
    assert os.path.isfile(pkg_json_path), (
        f"arktype is not installed at {pkg_json_path}."
    )
    with open(pkg_json_path) as f:
        data = json.load(f)
    assert data.get("version") == "2.2.0", (
        f"Expected arktype version '2.2.0', got '{data.get('version')}'."
    )


def test_convert_entrypoint_exists():
    assert os.path.isfile(CONVERT_JS), (
        f"Expected entrypoint {CONVERT_JS} does not exist."
    )


def test_length_meters_to_feet():
    result = _run_convert('{"kind":"length","meters":1}')
    assert result.returncode == 0, (
        f"length conversion exited non-zero. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert "3.28" in result.stdout, (
        f"Expected stdout to contain '3.28' for length 1 meter -> feet, "
        f"got stdout={result.stdout!r}."
    )


def test_mass_kilograms_to_pounds():
    result = _run_convert('{"kind":"mass","kilograms":1}')
    assert result.returncode == 0, (
        f"mass conversion exited non-zero. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert "2.20" in result.stdout, (
        f"Expected stdout to contain '2.20' for mass 1 kilogram -> pounds, "
        f"got stdout={result.stdout!r}."
    )


def test_temperature_celsius_to_fahrenheit():
    result = _run_convert('{"kind":"temperature","celsius":0}')
    assert result.returncode == 0, (
        f"temperature conversion exited non-zero. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert "32" in result.stdout, (
        f"Expected stdout to contain '32' for temperature 0 C -> F, "
        f"got stdout={result.stdout!r}."
    )


def test_unknown_kind_throws():
    result = _run_convert('{"kind":"volume","liters":1}')
    assert result.returncode != 0, (
        f"Expected non-zero exit when converter encounters unmatched input "
        f"(kind='volume'), but got exit code {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )


def _collect_js_sources() -> str:
    """Concatenate all .js/.mjs/.cjs/.ts sources under PROJECT_DIR (excluding node_modules)."""
    chunks: list[str] = []
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d != "node_modules" and not d.startswith(".")]
        for fname in files:
            if fname.endswith((".js", ".mjs", ".cjs", ".ts", ".mts", ".cts")):
                fpath = os.path.join(root, fname)
                try:
                    with open(fpath, encoding="utf-8") as f:
                        chunks.append(f.read())
                except (OSError, UnicodeDecodeError):
                    continue
    return "\n".join(chunks)


def test_implementation_uses_match_with_default_assert():
    sources = _collect_js_sources()
    assert re.search(r"\bmatch\s*\(", sources), (
        "Expected the implementation to call ArkType's `match(...)` API, "
        "but no `match(` call was found in project sources."
    )
    assert re.search(r"""default\s*:\s*['"]assert['"]""", sources), (
        "Expected the implementation to include an explicit `default: \"assert\"` "
        "case for ArkType's `match`, but it was not found in project sources."
    )
