import os
import subprocess
import time
import pytest
import asyncio
from prefect.client.orchestration import get_client
from prefect.flow_runs import resume_flow_run

PROJECT_DIR = "/home/user/app"
LOG_FILE = os.path.join(PROJECT_DIR, "output.log")

async def get_paused_flow_run():
    async with get_client() as client:
        runs = await client.read_flow_runs()
        for run in runs:
            if run.state_name == "Paused":
                return run
    return None

async def wait_for_completion(run_id, timeout=15):
    start_time = time.time()
    async with get_client() as client:
        while time.time() - start_time < timeout:
            run = await client.read_flow_run(run_id)
            if run.state_name == "Completed":
                return True
            time.sleep(1)
    return False

def test_pausing_and_resuming_flow():
    # Start the flow
    process = subprocess.Popen(
        ["python3", "flow.py"],
        cwd=PROJECT_DIR,
        stdout=open(LOG_FILE, "w"),
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid
    )
    
    try:
        # Wait for the flow to reach Paused state
        paused_run = None
        for _ in range(15):
            try:
                paused_run = asyncio.run(get_paused_flow_run())
                if paused_run:
                    break
            except Exception:
                pass
            time.sleep(1)
            
        assert paused_run is not None, "Flow run did not reach Paused state within 15 seconds."
        
        # Verify Task 1 output
        with open(LOG_FILE, "r") as f:
            content = f.read()
            
        assert "Task 1 complete" in content, f"Expected 'Task 1 complete' in output.log, got: {content}"
        assert "Task 2 complete" not in content, f"Expected 'Task 2 complete' to not be in output.log yet, got: {content}"
        
        # Resume the flow
        resume_flow_run(paused_run.id)
        
        # Wait for completion
        completed = asyncio.run(wait_for_completion(paused_run.id))
        assert completed, "Flow run did not reach Completed state after being resumed."
        
        # Verify Task 2 output
        with open(LOG_FILE, "r") as f:
            content = f.read()
            
        assert "Task 2 complete" in content, f"Expected 'Task 2 complete' in output.log after resume, got: {content}"
    
    finally:
        # Shut down the flow process if it's still running
        import signal
        try:
            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            process.wait(timeout=5)
        except Exception:
            pass
