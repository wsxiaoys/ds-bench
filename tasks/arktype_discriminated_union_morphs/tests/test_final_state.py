import json
import os
import subprocess
from pathlib import Path

PROJECT_DIR = "/home/user/myproject"


def _write_runner(path: str, content: str) -> None:
    Path(path).write_text(content)


def _run_tsx(script_name: str) -> "subprocess.CompletedProcess[str]":
    return subprocess.run(
        ["npx", "tsx", script_name],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=180,
    )


def test_package_json_pins_arktype_2_2_0():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json missing at {pkg_path}"
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    assert deps.get("arktype") == "2.2.0", (
        f"arktype dependency must be pinned to exactly '2.2.0', got {deps.get('arktype')!r}"
    )


def test_schema_module_exists():
    schema_path = os.path.join(PROJECT_DIR, "src", "schema.ts")
    assert os.path.isfile(schema_path), (
        f"Expected discriminated schema module at {schema_path}"
    )


def test_schema_int_branch_morphs_value_to_number():
    script = os.path.join(PROJECT_DIR, "__zealt_check_int.ts")
    _write_runner(
        script,
        'import { PayloadSchema } from "./src/schema.ts"\n'
        'import { type } from "arktype"\n'
        '\n'
        'const result = PayloadSchema({ kind: "int", value: "42" })\n'
        'if (result instanceof type.errors) {\n'
        '  console.error("ARKTYPE_ERRORS:" + result.summary)\n'
        '  process.exit(2)\n'
        '}\n'
        'console.log("RESULT:" + JSON.stringify(result))\n'
        'console.log("VALUE_TYPE:" + typeof (result as any).value)\n',
    )
    try:
        proc = _run_tsx("__zealt_check_int.ts")
    finally:
        try:
            os.remove(script)
        except OSError:
            pass
    assert proc.returncode == 0, (
        f"int-branch runner failed: rc={proc.returncode} stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )
    assert 'RESULT:{"kind":"int","value":42}' in proc.stdout, (
        f"Expected PayloadSchema to morph value to numeric 42 for kind=int, got stdout={proc.stdout!r}"
    )
    assert "VALUE_TYPE:number" in proc.stdout, (
        f"Expected morphed value to be a JS number, got stdout={proc.stdout!r}"
    )


def test_schema_raw_branch_preserves_string():
    script = os.path.join(PROJECT_DIR, "__zealt_check_raw.ts")
    _write_runner(
        script,
        'import { PayloadSchema } from "./src/schema.ts"\n'
        'import { type } from "arktype"\n'
        '\n'
        'const result = PayloadSchema({ kind: "raw", value: "42" })\n'
        'if (result instanceof type.errors) {\n'
        '  console.error("ARKTYPE_ERRORS:" + result.summary)\n'
        '  process.exit(2)\n'
        '}\n'
        'console.log("RESULT:" + JSON.stringify(result))\n'
        'console.log("VALUE_TYPE:" + typeof (result as any).value)\n',
    )
    try:
        proc = _run_tsx("__zealt_check_raw.ts")
    finally:
        try:
            os.remove(script)
        except OSError:
            pass
    assert proc.returncode == 0, (
        f"raw-branch runner failed: rc={proc.returncode} stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )
    assert 'RESULT:{"kind":"raw","value":"42"}' in proc.stdout, (
        f"Expected PayloadSchema to preserve string value for kind=raw, got stdout={proc.stdout!r}"
    )
    assert "VALUE_TYPE:string" in proc.stdout, (
        f"Expected value to remain a JS string, got stdout={proc.stdout!r}"
    )


def test_schema_rejects_unknown_kind():
    script = os.path.join(PROJECT_DIR, "__zealt_check_reject.ts")
    _write_runner(
        script,
        'import { PayloadSchema } from "./src/schema.ts"\n'
        'import { type } from "arktype"\n'
        '\n'
        'const result = PayloadSchema({ kind: "other", value: "42" })\n'
        'console.log("IS_ERRORS:" + (result instanceof type.errors))\n',
    )
    try:
        proc = _run_tsx("__zealt_check_reject.ts")
    finally:
        try:
            os.remove(script)
        except OSError:
            pass
    assert proc.returncode == 0, (
        f"reject runner failed unexpectedly: rc={proc.returncode} stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )
    assert "IS_ERRORS:true" in proc.stdout, (
        f"PayloadSchema must reject kind='other', got stdout={proc.stdout!r}"
    )


def test_broken_module_emits_parseerror():
    broken_path = os.path.join(PROJECT_DIR, "broken.ts")
    assert os.path.isfile(broken_path), f"broken.ts missing at {broken_path}"
    proc = subprocess.run(
        ["npx", "tsx", "broken.ts"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
        timeout=180,
    )
    combined = (proc.stdout or "") + (proc.stderr or "")
    assert proc.returncode != 0, (
        f"Expected `npx tsx broken.ts` to exit non-zero, got rc={proc.returncode}, "
        f"stdout={proc.stdout!r}, stderr={proc.stderr!r}"
    )
    assert "ParseError" in combined, (
        f"Expected the substring 'ParseError' in broken.ts output; "
        f"got stdout={proc.stdout!r}, stderr={proc.stderr!r}"
    )
