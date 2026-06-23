# Run Background Commands and Monitor Streaming Output

You are a developer building an AI coding assistant. You need to write a Python script `solve.py` that uses the E2B Python SDK to execute a long-running command in a sandbox and monitor its streaming output.

## Task Requirements

Write a python script `solve.py` that uses the E2B Python SDK to perform the following steps:

1. Create a new E2B sandbox.
2. Save the created sandbox ID to a local file `/home/user/e2b_task_info.json` under the key `sandbox_id`.
3. Inside the sandbox, create a bash script at `/home/user/task.sh` with the exact following content:
```bash
#!/bin/bash
echo 'Initializing...'
sleep 1
echo 'Running background job...'
sleep 1
echo 'Job complete.'
```
4. Make the script executable (`chmod +x /home/user/task.sh`) inside the sandbox.
5. Run the script as a background command using the E2B SDK.
6. Monitor or wait for the background command to finish, capturing its stdout.
7. Write the captured stdout to a file inside the sandbox at `/home/user/captured_stdout.txt`.
8. **Do not** close or kill the sandbox at the end of the script, so the verification step can check the files.

## Environment

- The E2B Python SDK is available.
- Assume `E2B_API_KEY` is already set in your environment.
- Your working directory is `/home/user`.
