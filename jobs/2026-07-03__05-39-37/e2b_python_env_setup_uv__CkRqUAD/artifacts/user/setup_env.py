#!/usr/bin/env python3
"""
Set up a reproducible Python data-science environment inside an E2B sandbox.

Steps performed (all inside the remote E2B sandbox):
  1. Start a new sandbox with a 600s timeout.
  2. Install `uv` (the fast Python package manager).
  3. Create a virtual environment at /home/user/venv with `uv`.
  4. Install `pandas` and `numpy` into that venv with `uv pip`.
  5. Print the installed pandas version using the venv's interpreter and
     save that output to /home/user/pandas_version.txt inside the sandbox.

Locally it writes the created sandbox id to /home/user/e2b_task_info.json
so REDACTEDmated tests can reconnect to the sandbox and verify the environment.
"""

import json
import sys
import time

from e2b import Sandbox

# How long (seconds) the sandbox should stay alive. The task requires at least
# 600 seconds — we use 600 to match the requirement exactly.
SANDBOX_TIMEOUT = 600

# Path inside the sandbox where the virtual environment lives.
VENV_PATH = "/home/user/venv"
VENV_PYTHON = f"{VENV_PATH}/bin/python"

# uv installs its binary into $HOME/.local/bin by default. The default E2B
# `user` has its home at /home/user, so the binary ends up at:
UV_BIN = "/home/user/.local/bin"

# Local output file describing the sandbox we created.
LOCAL_TASK_INFO = "/home/user/e2b_task_info.json"


def run_cmd(sb: Sandbox, description: str, cmd: str, timeout: float = 180) -> str:
    """Run a command in the sandbox, raising on failure.

    `uv` is installed under $HOME/.local/bin which is not on the default PATH
    for non-interactive shells, so we prepend it explicitly via the `envs`
    parameter for every command that needs `uv`.
    """
    print(f"\n>>> {description}")
    print(f"    $ {cmd}")
    result = sb.commands.run(
        cmd,
        envs={"PATH": f"{UV_BIN}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"},
        timeout=timeout,
    )
    stdout = (result.stdout or "").strip()
    stderr = (result.stderr or "").strip()
    if stdout:
        print(stdout)
    if stderr:
        print(stderr, file=sys.stderr)
    if result.exit_code != 0:
        raise RuntimeError(
            f"Command failed (exit {result.exit_code}): {cmd}\n"
            f"stdout: {stdout}\nstderr: {stderr}\nerror: {result.error}"
        )
    return stdout


def main() -> None:
    print("Creating E2B sandbox (timeout=600s)...")
    sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT)
    print(f"Sandbox created. sandbox_id = {sandbox.sandbox_id}")

    try:
        # ---------------------------------------------------------------
        # Step 2: Install uv in the sandbox.
        # ---------------------------------------------------------------
        run_cmd(
            sandbox,
            "Installing uv",
            "curl -LsSf https://astral.sh/uv/install.sh | sh",
            timeout=180,
        )
        run_cmd(sandbox, "Verifying uv", "uv --version", timeout=30)

        # ---------------------------------------------------------------
        # Step 3: Create the virtual environment at /home/user/venv.
        # ---------------------------------------------------------------
        run_cmd(
            sandbox,
            f"Creating virtual environment at {VENV_PATH}",
            f"uv venv {VENV_PATH}",
            timeout=60,
        )

        # ---------------------------------------------------------------
        # Step 4: Install pandas and numpy into the venv.
        # ---------------------------------------------------------------
        run_cmd(
            sandbox,
            "Installing pandas and numpy into the venv",
            f"uv pip install pandas numpy --python {VENV_PYTHON}",
            timeout=240,
        )

        # ---------------------------------------------------------------
        # Step 5: Print pandas version and save it to a file in sandbox.
        # ---------------------------------------------------------------
        version_cmd = (
            f'{VENV_PYTHON} -c "import pandas; print(pandas.__version__)" '
            f"> /home/user/pandas_version.txt"
        )
        run_cmd(sandbox, "Recording pandas version", version_cmd, timeout=30)

        # Read back the saved file to confirm it was written correctly.
        saved = sandbox.files.read("/home/user/pandas_version.txt", format="text")
        saved = saved.strip() if isinstance(saved, str) else str(saved).strip()
        print(f"\nSaved pandas version in sandbox: '{saved}'")

        # ---------------------------------------------------------------
        # Step 6: Persist the sandbox id locally for the test harness.
        # ---------------------------------------------------------------
        task_info = {"sandbox_id": sandbox.sandbox_id}
        with open(LOCAL_TASK_INFO, "w") as f:
            json.dump(task_info, f)
        print(f"\nWrote {LOCAL_TASK_INFO}: {task_info}")

        print("\nEnvironment setup complete. Sandbox will stay alive for "
              f"{SANDBOX_TIMEOUT}s (or until it times out).")
        print("Sandbox id:", sandbox.sandbox_id)

    except Exception:
        # On failure, surface the sandbox id so it can be cleaned up / debugged.
        print(f"\n[ERROR] Setup failed for sandbox {sandbox.sandbox_id}",
              file=sys.stderr)
        raise


if __name__ == "__main__":
    main()