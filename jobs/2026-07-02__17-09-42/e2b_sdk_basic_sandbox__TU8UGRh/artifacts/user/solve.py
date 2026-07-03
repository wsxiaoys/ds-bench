#!/usr/bin/env python3
"""Spawn an E2B sandbox, run a command, and persist credentials/IDs."""

import os
from e2b import Sandbox


def main() -> None:
    api_key = os.environ.get("E2B_API_KEY")
    if not api_key:
        raise RuntimeError("E2B_API_KEY environment variable is not set")

    # Persist the API key for later reference.
    with open("/home/user/e2b_api_key.txt", "w", encoding="utf-8") as f:
        f.write(api_key)

    # Spawn a sandbox from the default template, keeping it alive for 10 minutes.
    # Using Sandbox.create() with no `template` argument uses E2B's default template.
    sandbox = Sandbox.create(timeout=600)

    # Persist the sandbox ID immediately so it's available even if a later step fails.
    with open("/home/user/sandbox_id.txt", "w", encoding="utf-8") as f:
        f.write(sandbox.sandbox_id)

    # Execute the requested command inside the sandbox.
    result = sandbox.commands.run(
        "echo 'Hello E2B' > /home/user/hello.txt",
    )
    print(f"Command exit code: {result.exit_code}")
    print(f"Sandbox ID: {sandbox.sandbox_id}")


if __name__ == "__main__":
    main()