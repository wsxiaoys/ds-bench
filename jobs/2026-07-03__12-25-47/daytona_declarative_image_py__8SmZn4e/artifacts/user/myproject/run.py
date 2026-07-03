import os
import re
import sys

from daytona import Daytona, Image, CreateSandboxFromImageParams

LOG_PATH = "/home/user/myproject/output.log"


def main():
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()

    sandbox_name = f"decl-py-{run_id}"
    print(f"Using run-id: {run_id}, sandbox name: {sandbox_name}")

    # Build declarative image
    image = Image.debian_slim("3.12").pip_install(["requests", "pyyaml"])

    # Create the Daytona client
    daytona = Daytona()

    sandbox = None
    try:
        # Create sandbox from declarative image
        params = CreateSandboxFromImageParams(
            name=sandbox_name,
            image=image,
        )
        sandbox = daytona.create(params, timeout=180)
        print(f"Created sandbox: {sandbox.id}")

        # Run Python snippet that imports requests and yaml and prints versions
        snippet = (
            "import requests, yaml\n"
            "print(f'requests:{requests.__version__}')\n"
            "print(f'yaml:{yaml.__version__}')\n"
        )
        result = sandbox.process.code_run(snippet)
        print("--- code_run stdout ---")
        print(result.result)
        print("--- end ---")

        # Parse the printed versions
        lines = result.result.splitlines()
        versions = {}
        for line in lines:
            m = re.match(r"^(requests|yaml):\s*(.+)$", line.strip())
            if m:
                versions[m.group(1)] = m.group(2).strip()

        # Build output lines
        out_lines = []
        out_lines.append(f"requests: {versions.get('requests', '')}")
        out_lines.append(f"yaml: {versions.get('yaml', '')}")

        with open(LOG_PATH, "w") as f:
            f.write("\n".join(out_lines) + "\n")

        print(f"Wrote log to {LOG_PATH}")
    finally:
        if sandbox is not None:
            try:
                daytona.delete(sandbox)
                print(f"Deleted sandbox: {sandbox.id}")
            except Exception as e:
                print(f"Failed to delete sandbox: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
