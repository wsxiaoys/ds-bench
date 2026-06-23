import os
import subprocess
import time
import json
import pytest

PROJECT_DIR = "/home/user/project"

def test_sse_subscription_output():
    # Start the server
    server_process = subprocess.Popen(
        ["npm", "start"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    try:
        # Wait for the server to start
        time.sleep(3)
        
        # Run the client
        client_result = subprocess.run(
            ["npm", "run", "client"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True
        )
        
        # Check if client succeeded
        assert client_result.returncode == 0, f"Client failed: {client_result.stderr}"
        
        # Check output.json
        output_file = os.path.join(PROJECT_DIR, "output.json")
        assert os.path.isfile(output_file), "output.json was not generated."
        
        with open(output_file, "r") as f:
            data = json.load(f)
            
        assert data == [3, 2, 1, 0], f"Expected [3, 2, 1, 0], but got {data}"
        
    finally:
        server_process.terminate()
        server_process.wait()
