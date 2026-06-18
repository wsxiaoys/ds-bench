You are a security engineer testing code in sandboxed containers.

Write a standalone Python script that uses the E2B Python SDK to perform the following sequential operations:
1. Create an E2B Sandbox with a timeout of 600 seconds (to ensure it stays alive for verification).
2. Inside the sandbox, create a bash script at `/home/user/scan_network.sh` with the following exact content:
```bash
#!/bin/bash
echo 'Scanning open ports...'
echo 'Found vulnerable port 8080' >&2
echo 'Scan complete. 1 vulnerabilities found.'
```
3. Change the permissions of `/home/user/scan_network.sh` to make it executable (e.g., `chmod +x`).
4. Execute the script `/home/user/scan_network.sh` inside the sandbox using the SDK.
5. Capture the stdout and stderr from the command execution.
6. Write a file inside the sandbox at `/home/user/scan_results.txt` containing the captured outputs in the following format:
```
STDOUT:
<the captured stdout>
STDERR:
<the captured stderr>
```
7. Save the created sandbox ID to a local file at `/home/user/e2b_task_info.json` under the key `sandbox_id` (e.g. `{"sandbox_id": "..."}`), so that the automated test suite can verify the sandbox state.

Ensure you only use the `e2b` python package. The `e2b` package is already installed in the environment.
Run the script directly to create the sandbox and set up the environment.
