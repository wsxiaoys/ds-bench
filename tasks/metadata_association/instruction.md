As a DevOps engineer automating infrastructure provisioning, you need to create an E2B sandbox and attach specific metadata to associate it with a particular user and environment.

Write a Python script at `/home/user/manage_sandbox.py` that performs the following steps:
1. Creates a new sandbox using the `e2b` Python SDK.
2. Attaches the following metadata during creation:
   - `user_id`: `devops_user_99`
   - `environment`: `staging`
   - `purpose`: `infrastructure_testing`
3. Writes the created sandbox's ID to a file named `/home/user/sandbox_id.txt`.
4. Uses the SDK to retrieve the list of running sandboxes.
5. Finds the sandbox in the list matching the created sandbox's ID.
6. Writes the retrieved metadata of that sandbox as a JSON string to a file named `/home/user/retrieved_metadata.json`.
7. Leaves the sandbox running (do not kill it).

Run your script to ensure the files `/home/user/sandbox_id.txt` and `/home/user/retrieved_metadata.json` are generated successfully.