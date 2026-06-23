As a data scientist running analysis in isolated environments, you need to set up a Python environment inside an E2B sandbox using `uv` to ensure fast and reproducible dependency installation.

Your task is to write a Python script `setup_env.py` that:
1. Starts a new E2B Sandbox with a timeout of at least 600 seconds.
2. Uses the E2B SDK to run a command that installs `uv` in the sandbox (e.g., `curl -LsSf https://astral.sh/uv/install.sh | sh` and ensure it's in PATH).
3. Uses `uv` to create a virtual environment at `/home/user/venv` inside the sandbox.
4. Uses `uv pip` to install `pandas` and `numpy` into that virtual environment.
5. Runs a Python command inside the sandbox using the virtual environment's Python (`/home/user/venv/bin/python`) to print the pandas version, and saves the output to `/home/user/pandas_version.txt` inside the sandbox.
6. Writes the created sandbox ID to a local file at `/home/user/e2b_task_info.json` in the format `{"sandbox_id": "<the_id>"}` so the automated tests can connect to it and verify the environment.

The script must be fully automated and use the `e2b` Python SDK. Assume `E2B_API_KEY` is already set in your environment, run the script directly to create the sandbox and set up the environment.
