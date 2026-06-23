"""
Ephemeral Daytona sandbox example.

Reads DAYTONA_API_KEY and ZEALT_RUN_ID from the environment, spins up a
short-lived sandbox, captures the year from `date +%Y`, reads back the
auto_stop_interval from Daytona metadata, writes both values to output.log,
then stops the sandbox so Daytona auto-deletes it.
"""

import os
from daytona import Daytona, CreateSandboxFromSnapshotParams

# ── configuration ──────────────────────────────────────────────────────────────
api_key = os.environ["DAYTONA_API_KEY"]
run_id  = os.environ["ZEALT_RUN_ID"]

sandbox_name = f"ephem-py-{run_id}"

# ── create Daytona client ──────────────────────────────────────────────────────
daytona = Daytona()          # picks up DAYTONA_API_KEY automatically

# ── create ephemeral sandbox ───────────────────────────────────────────────────
params = CreateSandboxFromSnapshotParams(
    name=sandbox_name,
    ephemeral=True,
    auto_stop_interval=5,    # minutes until auto-stop / auto-delete
)

sandbox = daytona.create(params)

try:
    # ── run command inside the sandbox ─────────────────────────────────────────
    response = sandbox.process.exec("date +%Y")
    year = response.result.strip()

    # ── re-fetch sandbox metadata from Daytona ─────────────────────────────────
    sandbox_meta = daytona.get(sandbox.id)
    auto_stop    = sandbox_meta.auto_stop_interval   # integer minutes

    # ── write results to log file ──────────────────────────────────────────────
    log_path = os.path.join(os.path.dirname(__file__), "output.log")
    with open(log_path, "w") as fh:
        fh.write(f"Year: {year}\n")
        fh.write(f"AutoStop: {auto_stop}\n")

    print(f"Year: {year}")
    print(f"AutoStop: {auto_stop}")
    print(f"Log written to {log_path}")

finally:
    # ── stop sandbox (ephemeral flag causes Daytona to delete it) ──────────────
    sandbox.stop()
    print(f"Sandbox '{sandbox_name}' stopped and scheduled for deletion.")
