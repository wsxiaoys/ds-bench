"""Set up a Python environment inside an E2B sandbox using ``uv``.

This script:
    1. Starts a new E2B Sandbox with a timeout of at least 600 seconds.
    2. Installs ``uv`` inside the sandbox via the official installer.
    3. Creates a virtual environment at ``/home/user/venv``.
    4. Installs ``pandas`` and ``numpy`` into that venv using ``uv pip``.
    5. Runs the venv's Python to print the pandas version and writes the
       output to ``/home/user/pandas_version.txt`` inside the sandbox.
    6. Persists the sandbox id to ``/home/user/e2b_task_info.json`` on the
       local machine so REDACTEDmated tests can connect to it.

The sandbox is intentionally left running (we do **not** use the
:class:`Sandbox` as a context manager, because its ``__exit__`` kills the
sandbox) so the tests have a chance to verify the environment before the
sandbox's timeout expires.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from e2b import Sandbox


LOCAL_INFO_PATH = Path("/home/user/e2b_task_info.json")
SANDBOX_TIMEOUT_SECONDS = 600  # >= 600 seconds, as required.
VENV_DIR = "/home/user/venv"
VENV_PYTHON = f"{VENV_DIR}/bin/python"
PANDAS_VERSION_FILE = "/home/user/pandas_version.txt"


def _run(sandbox: Sandbox, command: str, *, timeout: float = 300.0) -> None:
    """Run a command inside ``sandbox`` and raise on failure.

    The output of the command is streamed to stdout/stderr for visibility.
    """
    print(f"\n$ {command}")
    result = sandbox.commands.run(command, timeout=timeout)
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
    if result.stderr:
        print(result.stderr, end="" if result.stderr.endswith("\n") else "\n", file=sys.stderr)
    if result.exit_code != 0:
        raise RuntimeError(
            f"Command failed with exit code {result.exit_code}: {command}"
        )


def main() -> None:
    api_key = os.environ.get("E2B_API_KEY")
    if not api_key:
        raise SystemExit(
            "E2B_API_KEY environment variable is not set; cannot create a sandbox."
        )

    print(f"Creating E2B sandbox (timeout={SANDBOX_TIMEOUT_SECONDS}s) ...")
    sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT_SECONDS)
    print(f"Sandbox created. sandbox_id={sandbox.sandbox_id}")

    try:
        # 2) Install uv via the official installer. The installer puts the
        # ``uv`` binary in ``$HOME/.local/bin/uv``; we export that directory
        # on PATH for every subsequent command to keep things explicit.
        uv_install_cmd = (
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "curl -LsSf https://astral.sh/uv/install.sh | sh && "
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "uv --version"
        )
        _run(sandbox, uv_install_cmd, timeout=300)

        # 3) Create a virtual environment at /home/user/venv.
        _run(sandbox, f"uv venv {VENV_DIR}", timeout=120)

        # 4) Install pandas and numpy into the venv using uv pip.
        _run(
            sandbox,
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            f"source {VENV_DIR}/bin/activate && "
            f"uv pip install --python {VENV_PYTHON} pandas numpy",
            timeout=600,
        )

        # 5) Run the venv's Python to print the pandas version and write it
        # to /home/user/pandas_version.txt inside the sandbox.
        version_cmd = (
            f"{VENV_PYTHON} -c "
            "\"import pandas as pd, sys; "
            "sys.stdout.write(pd.__version__)\" "
            f"> {PANDAS_VERSION_FILE}"
        )
        _run(sandbox, version_cmd, timeout=120)

        # Sanity check: read the file back via a shell command and print it,
        # so we can see in the local logs that the value was persisted.
        _run(sandbox, f"cat {PANDAS_VERSION_FILE}", timeout=30)
    except Exception:
        # Make sure we surface failures cleanly.
        try:
            sandbox.kill()
        except Exception:  # pragma: no cover - best-effort cleanup
            pass
        raise

    # 6) Persist the sandbox id locally so the tests can connect to it.
    LOCAL_INFO_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_INFO_PATH.write_text(json.dumps({"sandbox_id": sandbox.sandbox_id}))
    print(f"Wrote sandbox id to {LOCAL_INFO_PATH}")

    print(
        "Sandbox is left running so tests can verify the environment. "
        f"It will be killed REDACTEDmatically after {SANDBOX_TIMEOUT_SECONDS}s."
    )


if __name__ == "__main__":
    main()
