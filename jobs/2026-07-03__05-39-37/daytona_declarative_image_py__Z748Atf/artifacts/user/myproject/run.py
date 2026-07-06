#!/usr/bin/env python3
"""Build a Daytona sandbox from a declarative image, run code, capture versions."""

import sys
import re

from daytona import (
    Daytona,
    Image,
    CreateSandboxFromImageParams,
)

RUN_ID_PATH = "/logs/artifacts/run-id"
LOG_PATH = "/home/user/myproject/output.log"
SANDBOX_NAME_TEMPLATE = "decl-py-{run_id}"


def read_run_id() -> str:
    with open(RUN_ID_PATH, "r") as fh:
        return fh.read().strip()


def main() -> int:
    run_id = read_run_id()
    sandbox_name = SANDBOX_NAME_TEMPLATE.format(run_id=run_id)
    print(f"[run] run_id={run_id!r} sandbox_name={sandbox_name!r}")

    # Build a declarative image: debian_slim base with python 3.12, install requests & pyyaml.
    image = Image.debian_slim("3.12").pip_install(["requests", "pyyaml"])

    # Configure sandbox creation from the declarative image.
    params = CreateSandboxFromImageParams(
        name=sandbox_name,
        image=image,
    )

    daytona = Daytona()
    sandbox = None
    try:
        print("[run] Creating sandbox from declarative image (this may take a while)...")
        sandbox = daytona.create(params, timeout=600)
        print(f"[run] Sandbox created: id={sandbox.id}")

        # Python snippet that imports requests and yaml and prints installed versions.
        code = (
            "import requests, yaml\n"
            "print('requests:', requests.__version__)\n"
            "print('yaml:', yaml.__version__)\n"
        )

        print("[run] Running code inside sandbox...")
        response = sandbox.process.code_run(code)
        print(f"[run] exit_code={response.exit_code}")

        if response.exit_code != 0:
            print(f"[run] code_run failed. result={response.result!r}", file=sys.stderr)
            return 1

        output = response.result or ""
        print("[run] --- captured output ---")
        print(output)
        print("[run] --- end captured output ---")

        # Parse the printed version lines and write exactly two lines to the log file.
        requests_ver = None
        yaml_ver = None
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            m = re.match(r"^(requests|yaml)\s*:\s*(.+)$", line)
            if not m:
                continue
            pkg, ver = m.group(1), m.group(2).strip()
            if pkg == "requests":
                requests_ver = ver
            elif pkg == "yaml":
                yaml_ver = ver

        lines = []
        if requests_ver is not None:
            lines.append(f"requests: {requests_ver}")
        if yaml_ver is not None:
            lines.append(f"yaml: {yaml_ver}")

        if requests_ver is None or yaml_ver is None:
            print(
                f"[run] Could not parse versions (requests={requests_ver!r}, yaml={yaml_ver!r})",
                file=sys.stderr,
            )
            return 1

        with open(LOG_PATH, "w") as fh:
            fh.write("\n".join(lines) + "\n")

        print(f"[run] Wrote {LOG_PATH}:")
        with open(LOG_PATH, "r") as fh:
            print(fh.read())

        return 0
    finally:
        if sandbox is not None:
            print("[run] Deleting sandbox...")
            try:
                daytona.delete(sandbox)
                print("[run] Sandbox deleted.")
            except Exception as exc:  # noqa: BLE001
                print(f"[run] Warning: failed to delete sandbox: {exc}", file=sys.stderr)


if __name__ == "__main__":
    sys.exit(main())