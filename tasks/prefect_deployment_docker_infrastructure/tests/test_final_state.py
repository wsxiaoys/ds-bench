import os
import subprocess
import json
import time
import socket
import pytest

@pytest.fixture(scope="module", autouse=True)
def ensure_prefect_server():
    """Ensure the Prefect server is running before tests."""
    os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"
    
    # Check if it's already running
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        if sock.connect_ex(('127.0.0.1', 4200)) == 0:
            yield
            return

    # Start the server in the background
    process = subprocess.Popen(
        ["prefect", "server", "start"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=os.setsid,
        env=os.environ
    )
    
    # Wait for the server to be ready
    start_time = time.time()
    ready = False
    while time.time() - start_time < 30:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            if sock.connect_ex(('127.0.0.1', 4200)) == 0:
                ready = True
                break
        time.sleep(2)
        
    if not ready:
        import signal
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
        pytest.fail("Prefect server failed to start within 30 seconds.")
        
    yield
    
    # Clean up
    import signal
    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    process.wait(timeout=10)

def test_work_pool_exists():
    """Priority 1: Use Prefect CLI to verify the work pool."""
    os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"
    result = subprocess.run(
        ["prefect", "work-pool", "inspect", "my-docker-pool"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"'prefect work-pool inspect' failed: {result.stderr}"
    
    # The output is likely YAML/JSON or text, but we can just check if it contains 'docker'
    assert "docker" in result.stdout.lower() or "docker" in result.stderr.lower(), \
        f"Expected work pool type 'docker' in output, got: {result.stdout}"

def test_deployment_exists_and_configured():
    """Priority 1: Use Prefect CLI to verify the deployment."""
    os.environ["PREFECT_API_URL"] = "http://127.0.0.1:4200/api"
    result = subprocess.run(
        ["prefect", "deployment", "inspect", "hello-docker-flow/docker-deployment"],
        capture_output=True, text=True
    )
    assert result.returncode == 0, f"'prefect deployment inspect' failed: {result.stderr}"
    
    output = result.stdout + result.stderr
    
    # Check work pool association
    assert "my-docker-pool" in output, \
        f"Expected deployment to use 'my-docker-pool', got: {output}"
        
    # Check image configuration
    assert "my-prefect-image:latest" in output, \
        f"Expected deployment to use image 'my-prefect-image:latest', got: {output}"
