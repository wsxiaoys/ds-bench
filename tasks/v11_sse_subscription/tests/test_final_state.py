import os
import subprocess
import time
import json
import pytest

PROJECT_DIR = "/home/user/project"

def test_sse_subscription_output():
    # Start server
    server_proc = subprocess.Popen(
        ["npx", "tsx", "server.ts"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    try:
        # Wait for server to start
        time.sleep(2)
        
        # Run client
        client_proc = subprocess.run(
            ["npx", "tsx", "client.ts"],
            cwd=PROJECT_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10
        )
        
        # Verify output.json exists
        output_file = os.path.join(PROJECT_DIR, "output.json")
        assert os.path.isfile(output_file), "output.json was not created by the client."
        
        # Verify contents
        with open(output_file, "r") as f:
            data = json.load(f)
            
        assert data == [5, 4, 3, 2, 1], f"Expected [5, 4, 3, 2, 1], but got {data}"
        
        assert client_proc.returncode == 0, f"Client process failed with code {client_proc.returncode}. stderr: {client_proc.stderr.decode()}"
        
    finally:
        server_proc.terminate()
        server_proc.wait()
