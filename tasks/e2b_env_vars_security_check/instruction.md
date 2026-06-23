You are a security engineer testing code in sandboxed containers. Your goal is to create an E2B sandbox and configure it with two specific environment variables: 
- `SECRET_TOKEN` with the value `super-secret-123`
- `API_ENDPOINT` with the value `https://api.example.com`

Once the sandbox is running, execute a command to write the values of these environment variables to a file named `/home/user/env_dump.txt` in the format:
```
TOKEN=<value>
ENDPOINT=<value>
```

Finally, you must save the sandbox ID to `/home/user/e2b_task_info.json` on the host machine so the verification script can connect to it and verify the file contents. The JSON should be in the format `{"sandbox_id": "..."}`. 

Do not kill the sandbox after you are done. The `E2B_API_KEY` is already set in the environment.