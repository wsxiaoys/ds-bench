#!/usr/bin/env python3
"""Set up an E2B sandbox with a uv-managed Python environment."""

import json
import os
from e2b import Sandbox


def main():
    # 1. Start a new E2B Sandbox with timeout of at least 600 seconds.
    sandbox = Sandbox.create(timeout=600)
    sandbox_id = sandbox.sandbox_id
    print(f"Created sandbox: {sandbox_id}")

    try:
        # 2. Install uv inside the sandbox and ensure it's in PATH for subsequent commands.
        install_uv_cmd = (
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "curl -LsSf https://astral.sh/uv/install.sh | sh && "
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "uv --version"
        )
        result = sandbox.commands.run(install_uv_cmd)
        print("uv install stdout:", result.stdout)
        if result.exit_code != 0:
            print("uv install stderr:", result.stderr)
            raise RuntimeError("Failed to install uv")

        # 3. Use uv to create a virtual environment at /home/user/venv.
        create_venv_cmd = (
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "uv venv /home/user/venv --python python3"
        )
        result = sandbox.commands.run(create_venv_cmd)
        print("venv create stdout:", result.stdout)
        if result.exit_code != 0:
            print("venv create stderr:", result.stderr)
            raise RuntimeError("Failed to create venv")

        # 4. Use uv pip to install pandas and numpy into the virtual environment.
        install_pkgs_cmd = (
            "export PATH=\"$HOME/.local/bin:$PATH\" && "
            "uv pip install --python /home/user/venv/bin/python pandas numpy"
        )
        result = sandbox.commands.run(install_pkgs_cmd)
        print("uv pip install stdout:", result.stdout)
        if result.exit_code != 0:
            print("uv pip install stderr:", result.stderr)
            raise RuntimeError("Failed to install pandas/numpy")

        # 5. Run python from the venv to print pandas version and save to file.
        verify_cmd = (
            "/home/user/venv/bin/python -c \"import pandas; print(pandas.__version__)\" "
            "> /home/user/pandas_version.txt"
        )
        result = sandbox.commands.run(verify_cmd)
        print("verify stdout:", result.stdout)
        if result.exit_code != 0:
            print("verify stderr:", result.stderr)
            raise RuntimeError("Failed to verify pandas")

        # Read back the saved version for confirmation.
        cat_result = sandbox.commands.run("cat /home/user/pandas_version.txt")
        print("pandas_version.txt contents:", cat_result.stdout.strip())

    finally:
        # 6. Write the sandbox ID to a local file regardless of success path above.
        info_path = "/home/user/e2b_task_info.json"
        with open(info_path, "w") as f:
            json.dump({"sandbox_id": sandbox_id}, f)
        print(f"Wrote sandbox info to {info_path}")

    print("Environment setup complete.")


if __name__ == "__main__":
    main()
