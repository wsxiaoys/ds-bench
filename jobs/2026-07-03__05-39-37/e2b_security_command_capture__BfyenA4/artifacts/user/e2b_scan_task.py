#!/usr/bin/env python3
"""
Standalone script that uses the E2B Python SDK to:
1. Create an E2B Sandbox (timeout 600s).
2. Create a bash script at /home/user/scan_network.sh inside the sandbox.
3. Make the script executable.
4. Execute the script.
5. Capture stdout/stderr.
6. Write captured outputs to /home/user/scan_results.txt inside the sandbox.
7. Save the sandbox id to /home/user/e2b_task_info.json locally.
"""

import json

from e2b import Sandbox

SCRIPT_PATH = "/home/user/scan_network.sh"
SCRIPT_CONTENT = """#!/bin/bash
echo 'Scanning open ports...'
echo 'Found vulnerable port 8080' >&2
echo 'Scan complete. 1 vulnerabilities found.'
"""

RESULTS_PATH = "/home/user/scan_results.txt"
LOCAL_INFO_PATH = "/home/user/e2b_task_info.json"


def main() -> None:
    # 1. Create the sandbox with a 600-second timeout so it stays alive for verification.
    sandbox = Sandbox.create(timeout=600)
    print(f"Created sandbox with id: {sandbox.sandbox_id}")

    try:
        # 2. Create the bash script inside the sandbox.
        sandbox.files.write(SCRIPT_PATH, SCRIPT_CONTENT)
        print(f"Wrote script to {SCRIPT_PATH}")

        # 3. Make the script executable.
        sandbox.commands.run(f"chmod +x {SCRIPT_PATH}")
        print("Made script executable")

        # 4. Execute the script.
        result = sandbox.commands.run(SCRIPT_PATH)
        print(f"Executed script, exit code: {result.exit_code}")

        # 5. Capture stdout and stderr.
        stdout = result.stdout
        stderr = result.stderr
        print(f"Captured stdout: {stdout!r}")
        print(f"Captured stderr: {stderr!r}")

        # 6. Write the captured outputs to a results file inside the sandbox.
        results_content = f"STDOUT:\n{stdout}STDERR:\n{stderr}"
        sandbox.files.write(RESULTS_PATH, results_content)
        print(f"Wrote results to {RESULTS_PATH}")

    finally:
        # 7. Save the sandbox id locally so the test suite can verify the sandbox state.
        with open(LOCAL_INFO_PATH, "w") as f:
            json.dump({"sandbox_id": sandbox.sandbox_id}, f)
        print(f"Saved sandbox id to {LOCAL_INFO_PATH}")

    print("Done.")


if __name__ == "__main__":
    main()