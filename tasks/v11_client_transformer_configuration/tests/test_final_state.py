import os
import subprocess
import time
import pytest

PROJECT_DIR = "/home/user/project"

def test_client_configuration_fixed():
    client_trpc_path = os.path.join(PROJECT_DIR, "client", "trpc.ts")
    with open(client_trpc_path) as f:
        content = f.read()
    
    # Check that transformer is inside httpBatchLink
    assert "transformer: superjson" in content or "transformer" in content, "transformer configuration missing"
    assert "httpBatchLink" in content, "must use httpBatchLink"
    
    # Check that transformer is not in the root
    import re
    # This is a bit naive, but we can check if it's inside the links array
    assert "links: [" in content, "links array missing"

def test_client_execution():
    # Start the server in the background
    server_proc = subprocess.Popen(
        ["npm", "run", "start:server"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for the server to start
    time.sleep(3)
    
    try:
        # Run the client test
        result = subprocess.run(
            ["npm", "run", "test:client"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        print("Client stdout:", result.stdout)
        print("Client stderr:", result.stderr)
        
        assert result.returncode == 0, f"Client execution failed with return code {result.returncode}.\nStderr: {result.stderr}"
        assert "Successfully fetched Date object" in result.stdout, "Client did not successfully fetch and deserialize the Date object."
    finally:
        server_proc.terminate()
        server_proc.wait()
