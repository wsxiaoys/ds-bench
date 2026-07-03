import json
from e2b import Sandbox

def run_cmd(sb, cmd):
    print(f"Running: {cmd}")
    res = sb.commands.run(cmd)
    if res.exit_code != 0:
        print(f"Error running command: {cmd}")
        print(f"Exit code: {res.exit_code}")
        print(f"Stdout: {res.stdout}")
        print(f"Stderr: {res.stderr}")
        raise Exception(f"Command failed: {cmd}")
    return res

def main():
    # 1. Start a new E2B Sandbox with a timeout of 1200 seconds (at least 600s)
    print("Starting E2B sandbox...")
    sb = Sandbox.create(timeout=1200)
    print(f"Sandbox created with ID: {sb.sandbox_id}")

    try:
        # 2. Install uv in the sandbox
        # Note: curl ... | sh installs uv to /home/user/.local/bin/uv
        run_cmd(sb, "curl -LsSf https://astral.sh/uv/install.sh | sh")

        # Ensure uv is in PATH by symlinking it to /usr/local/bin
        run_cmd(sb, "sudo ln -sf /home/user/.local/bin/uv /usr/local/bin/uv")
        run_cmd(sb, "sudo ln -sf /home/user/.local/bin/uvx /usr/local/bin/uvx")

        # Verify uv is in PATH
        res = run_cmd(sb, "uv --version")
        print(f"Verified uv installation: {res.stdout.strip()}")

        # 3. Create a virtual environment at /home/user/venv inside the sandbox
        run_cmd(sb, "uv venv /home/user/venv")

        # 4. Use uv pip to install pandas and numpy into that virtual environment
        run_cmd(sb, "uv pip install --python /home/user/venv/bin/python pandas numpy")

        # 5. Run a Python command inside the sandbox using the virtual environment's Python
        # to print the pandas version, and saves the output to /home/user/pandas_version.txt
        run_cmd(sb, '/home/user/venv/bin/python -c "import pandas as pd; print(pd.__version__)" > /home/user/pandas_version.txt')

        # Verify the file was written and read its content
        res = run_cmd(sb, "cat /home/user/pandas_version.txt")
        print(f"Pandas version written to /home/user/pandas_version.txt: {res.stdout.strip()}")

        # 6. Write the created sandbox ID to a local file at /home/user/e2b_task_info.json
        local_info_path = "/home/user/e2b_task_info.json"
        info_data = {"sandbox_id": sb.sandbox_id}
        with open(local_info_path, "w") as f:
            json.dump(info_data, f)
        print(f"Successfully wrote sandbox info to {local_info_path}: {info_data}")

    except Exception as e:
        print(f"An error occurred during setup: {e}")
        print("Killing sandbox...")
        sb.kill()
        raise e

if __name__ == "__main__":
    main()
