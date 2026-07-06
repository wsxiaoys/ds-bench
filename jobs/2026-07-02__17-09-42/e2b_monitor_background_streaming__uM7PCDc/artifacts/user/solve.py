"""Solve script: uses the E2B Python SDK to create a sandbox, run a
long-running shell script as a background command, stream its output, and
persist the captured stdout inside the sandbox.

The sandbox is intentionally left running at the end so that a verification
step can inspect the produced files.
"""

import json

from e2b import Sandbox


TASK_INFO_PATH = "/home/user/e2b_task_info.json"
TASK_SCRIPT_PATH = "/home/user/task.sh"
CAPTURED_STDOUT_PATH = "/home/user/captured_stdout.txt"

TASK_SCRIPT_CONTENT = """#!/bin/bash
echo 'Initializing...'
sleep 1
echo 'Running background job...'
sleep 1
echo 'Job complete.'
"""


def main() -> None:
    # 1. Create a new E2B sandbox.
    sandbox = Sandbox.create()

    # 2. Save the sandbox ID locally so a later verification step can find it.
    with open(TASK_INFO_PATH, "w") as f:
        json.dump({"sandbox_id": sandbox.sandbox_id}, f)

    # 3. Write the task script into the sandbox.
    sandbox.files.write(TASK_SCRIPT_PATH, TASK_SCRIPT_CONTENT)

    # 4. Make the script executable inside the sandbox.
    sandbox.commands.run(f"chmod +x {TASK_SCRIPT_PATH}")

    # 5. Run the script as a background command. With background=True, the
    # E2B SDK returns a CommandHandle immediately without blocking on the
    # process itself, which lets us drive the streaming/monitoring ourselves.
    handle = sandbox.commands.run(
        f"bash {TASK_SCRIPT_PATH}",
        background=True,
        # 0 disables the per-command connection timeout so streaming stays
        # open for the full duration of the long-running process.
        timeout=0,
    )

    # 6. Monitor / wait for the background command to finish. wait() drains
    # the underlying event stream, invoking the stdout callback for each
    # streamed chunk and accumulating the full output for CommandResult.
    streamed_chunks: list[str] = []

    def on_stdout(chunk: str) -> None:
        # Echo streamed output live while also accumulating it for the
        # write-back step below.
        print(chunk, end="", flush=True)
        streamed_chunks.append(chunk)

    result = handle.wait(on_stdout=on_stdout)

    captured_stdout = result.stdout if result.stdout is not None else "".join(streamed_chunks)

    # 7. Write the captured stdout to a file inside the sandbox.
    sandbox.files.write(CAPTURED_STDOUT_PATH, captured_stdout)

    # 8. Intentionally do NOT close or kill the sandbox so the verification
    # step can inspect the produced files.
    print(
        f"Sandbox {sandbox.sandbox_id} is still running; "
        f"captured stdout written to {CAPTURED_STDOUT_PATH}",
        flush=True,
    )


if __name__ == "__main__":
    main()
