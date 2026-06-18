import os
from daytona import Daytona, CreateSandboxFromImageParams, Image


def main() -> None:
    run_id = os.environ.get("ZEALT_RUN_ID")
    if not run_id:
        raise RuntimeError("ZEALT_RUN_ID environment variable is not set")

    sandbox_name = f"decl-py-{run_id}"

    image = Image.debian_slim("3.12").pip_install(["requests", "pyyaml"])

    daytona = Daytona()
    sandbox = None

    try:
        params = CreateSandboxFromImageParams(name=sandbox_name, image=image)
        sandbox = daytona.create(params)

        response = sandbox.process.code_run(
            """
import requests
import yaml

print(f"requests: {requests.__version__}")
print(f"yaml: {yaml.__version__}")
"""
        )

        output_path = "/home/user/myproject/output.log"
        with open(output_path, "w", encoding="utf-8") as output_file:
            output_file.write(response.result.strip())
            output_file.write("\n")
    finally:
        if sandbox is not None:
            sandbox.delete()


if __name__ == "__main__":
    main()
