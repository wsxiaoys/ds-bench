import json
import sys
import e2b

# Create the sandbox with the two environment variables.
# Use a long timeout (e.g. 3600s) so the sandbox stays alive for verification.
print("Creating E2B sandbox with environment variables...")
sandbox = e2b.Sandbox.create(
    envs={
        "SECRET_TOKEN": "super-secret-123",
        "API_ENDPOINT": "https://api.example.com",
    },
    timeout=3600,
)

sandbox_id = sandbox.sandbox_id
print(f"Sandbox created. ID: {sandbox_id}")

# Execute a command to write the env var values to /home/user/env_dump.txt
print("Writing environment variables to /home/user/env_dump.txt ...")
proc = sandbox.commands.run(
    'mkdir -p /home/user && '
    'printf "TOKEN=%s\\nENDPOINT=%s\\n" "$SECRET_TOKEN" "$API_ENDPOINT" > /home/user/env_dump.txt'
)
print("Command exit code:", proc.exit_code)

# Verify the file was written correctly by reading it back
print("Verifying file contents...")
verify = sandbox.commands.run("cat /home/user/env_dump.txt")
print("File contents:\n" + verify.stdout)

# Save the sandbox ID to /home/user/e2b_task_info.json on the host
info = {"sandbox_id": sandbox_id}
with open("/home/user/e2b_task_info.json", "w") as f:
    json.dump(info, f)
print("Saved sandbox ID to /home/user/e2b_task_info.json")

# IMPORTANT: Do not kill the sandbox. We keep it running by not calling sandbox.kill()
print("Done. Sandbox is left running for verification.")