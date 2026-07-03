"""
solve.py

Spawns an E2B sandbox from the default (`base`) template, keeps it alive for
at least 10 minutes (timeout=600 seconds), runs a command inside it that
writes a file, and finally persists the sandbox ID and the E2B API key to
local files.
"""

import os

from e2b import Sandbox

# Local output file paths.
SANDBOX_ID_FILE = "/home/user/sandbox_id.txt"
API_KEY_FILE = "/home/user/e2b_api_key.txt"

# Keep the sandbox alive for 10 minutes (600 seconds).
SANDBOX_TIMEOUT_SECONDS = 600


def main() -> None:
    # The E2B SDK reads the API key from the E2B_API_KEY environment variable
    # REDACTEDmatically, but we also grab it here so we can save it to disk.
    api_key = os.environ.get("E2B_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "E2B_API_KEY environment variable is not set. "
            "Set it before running this script."
        )

    # Spawn a sandbox from the default `base` template (template=None).
    # timeout=600 keeps the sandbox alive for 10 minutes.
    sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT_SECONDS)

    sandbox_id = sandbox.sandbox_id
    print(f"Spawned sandbox with ID: {sandbox_id}")
    print(f"Sandbox will stay alive for {SANDBOX_TIMEOUT_SECONDS} seconds.")

    # Run the requested command inside the sandbox.
    # The default base template's workdir is /home/user, so writing to
    # /home/user/hello.txt works as intended.
    command = "echo 'Hello E2B' > /home/user/hello.txt"
    result = sandbox.commands.run(command)
    print(f"Command exit code: {result.exit_code}")
    if result.stdout:
        print(f"stdout: {result.stdout}")
    if result.stderr:
        print(f"stderr: {result.stderr}")

    # Verify the file was created inside the sandbox.
    verify = sandbox.commands.run("cat /home/user/hello.txt")
    print(f"Verification (cat /home/user/hello.txt): {verify.stdout.strip()}")

    # Persist the spawned sandbox ID to a local file.
    with open(SANDBOX_ID_FILE, "w") as f:
        f.write(sandbox_id)
    print(f"Wrote sandbox ID to {SANDBOX_ID_FILE}")

    # Persist the E2B API key to a local file.
    with open(API_KEY_FILE, "w") as f:
        f.write(api_key)
    print(f"Wrote E2B API key to {API_KEY_FILE}")

    # Note: we intentionally do NOT call sandbox.kill().
    # The sandbox remains alive on the E2B side for the full timeout
    # (10 minutes) so it stays running after this script exits.
    print("Done. Sandbox left running (will REDACTED-pause after the timeout).")


if __name__ == "__main__":
    main()