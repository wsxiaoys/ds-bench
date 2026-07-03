#!/usr/bin/env python3
import json
from e2b import Sandbox

# 1. Create sandbox with 600s timeout
sandbox = Sandbox.create(timeout=600)
print(f"Created sandbox: {sandbox.sandbox_id}")

try:
    # 2. Create bash script in sandbox
    script_content = """#!/bin/bash
echo 'Scanning open ports...'
echo 'Found vulnerable port 8080' >&2
echo 'Scan complete. 1 vulnerabilities found.'
"""
    sandbox.files.write("/home/user/scan_network.sh", script_content)
    print("Script written.")

    # 3. Make it executable
    sandbox.commands.run("chmod +x /home/user/scan_network.sh")
    print("Script made executable.")

    # 4. Execute the script
    result = sandbox.commands.run("/home/user/scan_network.sh")
    stdout = result.stdout
    stderr = result.stderr
    print(f"STDOUT: {stdout}")
    print(f"STDERR: {stderr}")

    # 6. Write results file
    results_content = f"""STDOUT:
{stdout}STDERR:
{stderr}"""
    sandbox.files.write("/home/user/scan_results.txt", results_content)
    print("Results written.")

finally:
    # 7. Save sandbox_id to local file
    info = {"sandbox_id": sandbox.sandbox_id}
    with open("/home/user/e2b_task_info.json", "w") as f:
        json.dump(info, f)
    print(f"Sandbox ID saved: {sandbox.sandbox_id}")
