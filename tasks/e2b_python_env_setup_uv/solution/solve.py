import json
from e2b import Sandbox

def main():
    # 1. Start a new E2B Sandbox with a timeout of at least 600 seconds.
    sandbox = Sandbox(timeout=600)
    
    # 2. Install uv in the sandbox.
    sandbox.process.start_and_wait("curl -LsSf https://astral.sh/uv/install.sh | sh")
    
    # 3. Use uv to create a virtual environment at /home/user/venv.
    sandbox.process.start_and_wait("/home/user/.local/bin/uv venv /home/user/venv")
    
    # 4. Use uv pip to install pandas and numpy into that virtual environment.
    sandbox.process.start_and_wait("/home/user/.local/bin/uv pip install pandas numpy --python /home/user/venv")
    
    # 5. Run a Python command inside the sandbox to print the pandas version, and save the output.
    sandbox.process.start_and_wait("/home/user/venv/bin/python -c 'import pandas; print(pandas.__version__)' > /home/user/pandas_version.txt")
    
    # 6. Write the created sandbox ID to a local file.
    with open("/home/user/e2b_task_info.json", "w") as f:
        json.dump({"sandbox_id": sandbox.sandbox_id}, f)

    # We do not close the sandbox so it stays alive for the verifier.
    sandbox.keep_alive(600)

if __name__ == "__main__":
    main()
