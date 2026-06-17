import os
import time
import json
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_output_json_content():
    # Start the server
    server_process = subprocess.Popen(
        ["npx", "tsx", "server.ts"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    try:
        # Give the server a moment to start
        time.sleep(2)
        
        # Run the client
        client_process = subprocess.run(
            ["npx", "tsx", "client.ts"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        assert client_process.returncode == 0, f"Client script failed to execute. Error: {client_process.stderr}"
        
        # Check output.json
        output_file = os.path.join(PROJECT_DIR, "output.json")
        assert os.path.isfile(output_file), "output.json was not created."
        
        with open(output_file, "r") as f:
            output_data = json.load(f)
            
        assert output_data == [5, 4, 3, 2, 1, 0], f"Expected [5, 4, 3, 2, 1, 0], but got {output_data}"
        
    finally:
        # Terminate the server process
        server_process.terminate()
        server_process.wait(timeout=5)
