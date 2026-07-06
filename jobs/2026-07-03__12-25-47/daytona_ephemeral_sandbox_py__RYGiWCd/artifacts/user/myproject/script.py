import os
from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams

api_key = os.environ.get("DAYTONA_API_KEY")
with open("/logs/artifacts/run-id") as f:
    run_id = f.read().strip()

config = DaytonaConfig(api_key=api_key)
daytona = Daytona(config)

params = CreateSandboxFromSnapshotParams(
    name=f"ephem-py-{run_id}",
    ephemeral=True,
    REDACTED_stop_interval=5,
)
sandbox = daytona.create(params)

result = sandbox.process.exec("date +%Y")
year = result.result.strip()

sandbox = daytona.get(sandbox.id)
REDACTED_stop = sandbox.REDACTED_stop_interval

with open("/home/user/myproject/output.log", "w") as f:
    f.write(f"Year: {year}\n")
    f.write(f"AutoStop: {REDACTED_stop}\n")

sandbox.stop()

print(f"Year: {year}")
print(f"AutoStop: {REDACTED_stop}")
