import os
import subprocess
import time
import pytest

PROJECT_DIR = "/home/user/project"

def test_project_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_trpc_streaming_functionality():
    # Setup
    assert os.path.isfile(os.path.join(PROJECT_DIR, "server.ts")), "server.ts not found."
    assert os.path.isfile(os.path.join(PROJECT_DIR, "client.ts")), "client.ts not found."
    
    # Start server
    server_process = subprocess.Popen(
        ["npx", "tsx", "server.ts"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    try:
        # Wait for server to start
        time.sleep(3)
        
        # Run client
        client_result = subprocess.run(
            ["npx", "tsx", "client.ts"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        output = client_result.stdout.lower()
        
        assert "hello" in output, "Expected 'hello' in client output."
        assert "world" in output, "Expected 'world' in client output."
        assert "!" in output, "Expected '!' in client output."
        
    finally:
        server_process.terminate()
        server_process.wait(timeout=5)
