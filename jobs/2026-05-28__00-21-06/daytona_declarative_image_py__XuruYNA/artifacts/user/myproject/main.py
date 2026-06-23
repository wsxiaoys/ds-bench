import os
import sys
from daytona import Daytona, Image, CreateSandboxFromImageParams

def main():
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        print("ERROR: ZEALT_RUN_ID environment variable is not set", file=sys.stderr)
        sys.exit(1)

    sandbox_name = f"decl-py-{run_id}"
    log_path = "/home/user/myproject/output.log"

    print(f"Run ID: {run_id}")
    print(f"Sandbox name: {sandbox_name}")

    # Build declarative image: debian_slim 3.12 + requests + pyyaml
    image = Image.debian_slim("3.12").pip_install(["requests", "pyyaml"])

    # Initialize Daytona client (picks up DAYTONA_API_KEY from env)
    daytona = Daytona()

    sandbox = None
    try:
        print(f"Creating sandbox '{sandbox_name}' from declarative image...")
        params = CreateSandboxFromImageParams(
            image=image,
            name=sandbox_name,
        )
        sandbox = daytona.create(params)
        print(f"Sandbox created: {sandbox.id}")

        # Run Python snippet inside sandbox to get installed versions
        snippet = (
            "import requests, yaml; "
            "print(f'requests: {requests.__version__}'); "
            "print(f'yaml: {yaml.__version__}')"
        )
        print("Running code inside sandbox...")
        response = sandbox.process.code_run(snippet)
        output = response.result.strip()
        print(f"Output from sandbox:\n{output}")

        # Write versions to log file
        with open(log_path, "w") as f:
            f.write(output + "\n")
        print(f"Log written to {log_path}")

    finally:
        if sandbox is not None:
            print(f"Deleting sandbox '{sandbox_name}'...")
            daytona.delete(sandbox)
            print("Sandbox deleted.")

if __name__ == "__main__":
    main()
