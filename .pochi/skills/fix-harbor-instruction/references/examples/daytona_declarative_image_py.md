# Example: daytona_declarative_image_py

## instruction.md diff (from PR #37)

```diff
diff --git a/tasks/daytona_declarative_image_py/instruction.md b/tasks/daytona_declarative_image_py/instruction.md
index 0daaca10cff..61c93390b19 100644
--- a/tasks/daytona_declarative_image_py/instruction.md
+++ b/tasks/daytona_declarative_image_py/instruction.md
@@ -18,14 +18,6 @@ Daytona's Declarative Builder lets you define sandbox images programmatically us
 - `sandbox.process.code_run` returns an object whose `result` attribute contains the captured stdout from the executed Python snippet; parse the printed versions and write them in the required format on the host.
 - Make sure the sandbox is deleted at the end, even if it was successfully created.
 - Do not mock the Daytona service; interact with the real Daytona SaaS.
-
-## Acceptance Criteria
 - Project path: /home/user/myproject
 - Log file: /home/user/myproject/output.log
-- The sandbox created in Daytona must be named `decl-py-${run-id}`, where `run-id` is read from `/logs/artifacts/run-id`.
-- The sandbox must be built from a declarative `Image` based on `debian_slim('3.12')` with `requests` and `pyyaml` installed via `pip_install`.
-- The log file must contain exactly two lines (in any order) with the following formats:
-  - `requests: <version>` where `<version>` is the installed `requests` package version (a dotted version string such as `2.32.3`).
-  - `yaml: <version>` where `<version>` is the installed `PyYAML` runtime version reported by `yaml.__version__` (a dotted version string such as `6.0.2`).
-- The sandbox `decl-py-${run-id}` must be deleted after the task completes.
-
+- The log file must contain exactly two lines (in any order) of the form `requests: <version>` and `yaml: <version>`.
```

## tests/test_final_state.py (full)

```python
import os
import re

import pytest


LOG_FILE = "/home/user/myproject/output.log"
VERSION_RE = re.compile(r"^\d+(?:\.\d+)+[A-Za-z0-9.\-+]*$")


def _read_log_lines():
    assert os.path.isfile(LOG_FILE), (
        f"Expected log file {LOG_FILE} to exist after the task completes."
    )
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        return [line.rstrip("\n") for line in f.readlines() if line.strip()]


def _find_value(lines, prefix):
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(prefix):
            return stripped[len(prefix):].strip()
    return None


def test_output_log_has_requests_version():
    lines = _read_log_lines()
    value = _find_value(lines, "requests:")
    assert value is not None, (
        f"Expected a line starting with 'requests:' in {LOG_FILE}. "
        f"Got lines: {lines!r}"
    )
    assert VERSION_RE.match(value), (
        f"Expected the 'requests:' line in {LOG_FILE} to contain a dotted "
        f"version string (e.g. '2.32.3'), got: {value!r}"
    )


def test_output_log_has_yaml_version():
    lines = _read_log_lines()
    value = _find_value(lines, "yaml:")
    assert value is not None, (
        f"Expected a line starting with 'yaml:' in {LOG_FILE}. "
        f"Got lines: {lines!r}"
    )
    assert VERSION_RE.match(value), (
        f"Expected the 'yaml:' line in {LOG_FILE} to contain a dotted "
        f"version string (e.g. '6.0.2'), got: {value!r}"
    )


def test_sandbox_deleted_after_task():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key, (
        "DAYTONA_API_KEY is not set; cannot verify sandbox cleanup against "
        "the real Daytona service."
    )
    run_id = open("/logs/artifacts/run-id").read().strip()
    assert run_id, (
        "RUN_ID is not set; cannot determine the expected sandbox name."
    )
    expected_name = f"decl-py-{run_id}"

    try:
        from daytona import Daytona, DaytonaConfig
    except ImportError as exc:
        pytest.fail(
            f"Daytona Python SDK is not installed in the verifier environment: {exc}"
        )

    client = Daytona(DaytonaConfig(api_key=api_key))
    sandboxes = client.list()

    remaining = []
    for sb in sandboxes:
        name = getattr(sb, "name", None)
        if name is None:
            # Some SDK builds expose name under a nested attribute.
            name = getattr(getattr(sb, "info", None), "name", None)
        if name == expected_name:
            remaining.append(name)

    assert not remaining, (
        f"Expected sandbox named '{expected_name}' to be deleted, but it still "
        f"exists in Daytona. Found matching sandboxes: {remaining!r}"
    )
```
