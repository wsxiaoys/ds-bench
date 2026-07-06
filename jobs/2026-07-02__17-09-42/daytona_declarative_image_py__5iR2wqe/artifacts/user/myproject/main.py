"""Build a Daytona Sandbox from a Declarative Image using the Python SDK."""

import os
import re
import sys
from pathlib import Path

from daytona import CreateSandboxFromImageParams, Daytona, Image


RUN_ID_FILE = Path("/logs/artifacts/run-id")
OUTPUT_LOG = Path("/home/user/myproject/output.log")


def read_run_id() -> str:
    """Read the run-id from the artifacts file."""
    if not RUN_ID_FILE.exists():
        raise FileNotFoundError(f"Run-id file not found at {RUN_ID_FILE}")
    return RUN_ID_FILE.read_text().strip()


def parse_versions(stdout: str) -> dict[str, str]:
    """Parse printed `package: version` lines from stdout."""
    versions: dict[str, str] = {}
    for line in stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        match = re.match(r"^([A-Za-z0-9_\-]+)\s*:\s*(.+)$", line)
        if match:
            key = match.group(1).lower()
            if key in ("requests", "yaml"):
                versions[key] = match.group(2).strip()
    return versions


def main() -> int:
    run_id = read_run_id()
    sandbox_name = f"decl-py-{run_id}"
    print(f"[host] Using run-id={run_id!r} -> sandbox name={sandbox_name!r}")

    # Build the declarative image from debian_slim('3.12') with requests + pyyaml
    image = Image.debian_slim("3.12").pip_install(["requests", "pyyaml"])
    print(f"[host] Declarative image built: {image}")

    daytona = Daytona()  # uses DAYTONA_API_KEY env var
    sandbox = None
    try:
        # Create the sandbox from the declarative image
        sandbox = daytona.create(
            CreateSandboxFromImageParams(
                name=sandbox_name,
                image=image,
            ),
            timeout=300,
        )
        print(f"[host] Sandbox created: id={sandbox.id} name={sandbox.name}")

        # Execute Python that imports the packages and prints versions
        code = (
            "import requests\n"
            "import yaml\n"
            "print('requests:', requests.__version__)\n"
            "print('yaml:', yaml.__version__)\n"
        )
        response = sandbox.process.code_run(code)
        print(f"[host] code_run exit_code={response.exit_code}")
        print(f"[host] code_run result:\n{response.result}")

        versions = parse_versions(response.result)
        if "requests" not in versions or "yaml" not in versions:
            raise RuntimeError(
                f"Could not parse versions from output: {response.result!r}"
            )

        # Write to the required log file (exactly two lines)
        OUTPUT_LOG.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_LOG.write_text(
            f"requests: {versions['requests']}\n"
            f"yaml: {versions['yaml']}\n"
        )
        print(f"[host] Wrote {OUTPUT_LOG}")
    finally:
        if sandbox is not None:
            try:
                daytona.delete(sandbox, timeout=120)
                print(f"[host] Sandbox deleted: {sandbox_name}")
            except Exception as exc:  # noqa: BLE001
                print(f"[host] Failed to delete sandbox {sandbox_name}: {exc}")

    return 0


if __name__ == "__main__":
    sys.exit(main())