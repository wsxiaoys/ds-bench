Write and run a Python script `solve.py` in `/home/user` that uses the E2B Python SDK to spawn a sandbox from the default template. 
In the sandbox, execute the command `echo 'Hello E2B' > /home/user/hello.txt`. 
Keep the sandbox alive for at least 10 minutes (e.g., by setting `timeout=600`). 
Finally, the script must write the spawned sandbox ID to a local file `/home/user/sandbox_id.txt`, 
and save the E2B_API_KEY into /home/user/e2b_api_key.txt.
