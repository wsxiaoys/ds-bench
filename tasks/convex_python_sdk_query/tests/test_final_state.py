import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_add_task():
    """Verify that a task can be added using the Python script."""
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run-id")
    task_text = f"test-task-{run_id}"
    
    cmd = ["npx", "convex", "deploy", "--cmd", f"python3 run.py --add {task_text}"]
    result = subprocess.run(cmd, cwd=PROJECT_DIR, capture_output=True, text=True)
    
    assert result.returncode == 0, f"Failed to add task: {result.stderr}\nStdout: {result.stdout}"

def test_list_tasks():
    """Verify that the added task is listed by the Python script."""
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run-id")
    task_text = f"test-task-{run_id}"
    
    cmd = ["npx", "convex", "deploy", "--cmd", "python3 run.py --list"]
    result = subprocess.run(cmd, cwd=PROJECT_DIR, capture_output=True, text=True)
    
    assert result.returncode == 0, f"Failed to list tasks: {result.stderr}\nStdout: {result.stdout}"
    assert task_text in result.stdout, f"Expected {task_text} in output, got: {result.stdout}"
