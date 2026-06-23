import os
import subprocess
import time
import json
import pytest

PROJECT_DIR = "/home/user/project"

def test_package_json_updated():
    with open(os.path.join(PROJECT_DIR, "package.json")) as f:
        pkg = json.load(f)
    
    trpc_server = pkg.get("dependencies", {}).get("@trpc/server", "")
    trpc_client = pkg.get("dependencies", {}).get("@trpc/client", "")
    
    assert "next" in trpc_server or "11." in trpc_server, "package.json @trpc/server is not updated to v11"
    assert "next" in trpc_client or "11." in trpc_client, "package.json @trpc/client is not updated to v11"

def test_client_ts_updated():
    with open(os.path.join(PROJECT_DIR, "client.ts")) as f:
        content = f.read()
    
    # Check that transformer is inside httpBatchLink
    assert "httpBatchLink({" in content
    assert "transformer" in content
    
    # Simple heuristic to ensure transformer is inside httpBatchLink and not at root
    # Since createTRPCProxyClient is called, we can check if it has links and transformer inside links
    import re
    # Match transformer inside httpBatchLink
    match = re.search(r'httpBatchLink\s*\(\s*{[^}]*transformer\s*:', content)
    assert match is not None, "client.ts does not have transformer inside httpBatchLink"
    
    # Ensure it's not at the root
    # A bit tricky with regex, but we can check if it's not immediately after createTRPCProxyClient
    root_match = re.search(r'createTRPCProxyClient<AppRouter>\s*\(\s*{\s*transformer\s*:', content)
    assert root_match is None, "client.ts still has transformer at the root of createTRPCProxyClient"

def test_server_and_client_execution():
    # Start server
    server_process = subprocess.Popen(
        ["npm", "run", "start:server"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    time.sleep(3) # Wait for server to start
    
    # Run client
    client_process = subprocess.run(
        ["npm", "run", "start:client"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    server_process.terminate()
    server_process.wait()
    
    assert client_process.returncode == 0, f"Client failed with error: {client_process.stderr}"
    assert "status" in client_process.stdout and "success" in client_process.stdout, "Client output does not contain expected response"
