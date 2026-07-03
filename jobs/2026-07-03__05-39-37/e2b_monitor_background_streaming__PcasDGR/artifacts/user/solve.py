#!/usr/bin/env python3
"""Use the E2B Python SDK to run a background command in a sandbox and capture its stdout."""

import json

from e2b import Sandbox

TASK_SCRIPT = """#!/bin/bash
echo 'Initializing...'
sleep 1
echo 'Running background job...'
sleep 1
echo 'Job complete.'
"""

# Local file that stores the sandbox ID for the verification step.
TASK_INFO_PATH = "/home/user/e2b_task_info.json"

# Paths inside the sandbox.
SANDBOX_TASK_SH = "/home/user/task.sh"
SANDBOX_CAPTURED_STDOUT = "/home/user/captured_stdout.txt"


def main() -> None:
    # 1. Create a new E2B sandbox.
    #    A generous timeout keeps the sandbox alive for post-run verification.
    sandbox = Sandbox.create(timeout=300)

    # 2. Save the created sandbox ID to a local file.
    with open(TASK_INFO_PATH, "w") as f:
        json.dump({"sandbox_id": sandbox.sandbox_id}, f, indent=2)
    print(f"Saved sandbox ID {sandbox.sandbox_id} to {TASK_INFO_PATH}")

    try:
        # 3. Create the bash script inside the sandbox.
        sandbox.files.write(SANDBOX_TASK_SH, TASK_SCRIPT)
        print(f"Wrote script to {SANDBOX_TASK_SH} in the sandbox")

        # 4. Make the script executable inside the sandbox.
        sandbox.commands.run(f"chmod +x {SANDBOX_TASK_SH}")
        print(f"Made {SANDBOX_TASK_SH} executable")

        # 5. Run the script as a background command using the E2B SDK.
        #    background=True returns a CommandHandle instead of blocking on a
        #    CommandResult directly.
        background_cmd = sandbox.commands.run(
            f"bash {SANDBOX_TASK_SH}",
            background=True,
            timeout=120,
        )
        print(f"Started background command (pid={background_cmd.pid})")

        # 6. Monitor / wait for the background command to finish, capturing
        #    its stdout via the on_stdout callback.
        stdout_chunks: list[str] = []

        def on_stdout(line: str) -> None:
            print(f"[stdout] {line}", end="")
            stdout_chunks.append(line)

        result = background_cmd.wait(on_stdout=on_stdout)
        captured_stdout = result.stdout
        print(f"\nBackground command finished with exit code {result.exit_code}")

        # 7. Write the captured stdout to a file inside the sandbox.
        sandbox.files.write(SANDBOX_CAPTURED_STDOUT, captured_stdout)
        print(f"Wrote captured stdout to {SANDBOX_CAPTURED_STDOUT} in the sandbox")

        print("Captured stdout:")
        print(captured_stdout)
    except Exception:
        # 8. Do not close or kill the sandbox on success.
        #    On failure we still leave the sandbox running so the verification
        #    step can inspect it, but re-raise so the error is visible.
        raise

    # Intentionally do NOT call sandbox.kill() — the sandbox must stay alive
    # so the verification step can check the files written inside it.
    print("Done. Sandbox left running for verification.")


if __name__ == "__main__":
    main()