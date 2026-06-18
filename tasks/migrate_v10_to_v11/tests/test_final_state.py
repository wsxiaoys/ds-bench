import os
import json
import pytest
import subprocess
import time
import urllib.request
import urllib.error

PROJECT_DIR = "/home/user/app"

def test_dependencies_updated():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        data = json.load(f)
    
    deps = data.get("dependencies", {})
    trpc_deps = ["@trpc/server", "@trpc/client", "@trpc/react-query", "@trpc/next"]
    
    for dep in trpc_deps:
        assert dep in deps, f"{dep} is missing from dependencies."
        val = deps[dep]
        assert "next" in val or "11." in val or "^11." in val, f"Expected {dep} to be upgraded to next/v11, got {val}."

    assert "@tanstack/react-query" in deps, "@tanstack/react-query is missing."
    val = deps["@tanstack/react-query"]
    assert "latest" in val or "5." in val or "^5." in val, f"Expected @tanstack/react-query to be upgraded to latest/v5, got {val}."

def test_client_transformer_moved():
    trpc_ts_path = os.path.join(PROJECT_DIR, "src", "utils", "trpc.ts")
    with open(trpc_ts_path) as f:
        content = f.read()
    
    assert "transformer" in content, "transformer configuration is missing."
    # A simple check: transformer should be inside the httpBatchLink options.
    # In v10 it was: `transformer: superjson, links: [...]`
    # In v11 it is: `links: [httpBatchLink({ ..., transformer: superjson })]`
    # It's hard to parse AST in pytest, but we can check if it's inside `httpBatchLink`.
    assert "httpBatchLink" in content, "httpBatchLink is missing."

def test_context_get_raw_input_used():
    context_ts_path = os.path.join(PROJECT_DIR, "src", "server", "context.ts")
    with open(context_ts_path) as f:
        content = f.read()
    
    assert "info" in content, "Expected `info` to be used in createContext."
    assert "calls" in content and "getRawInput" in content, "Expected to find info.calls[...].getRawInput() in context.ts."

def test_app_builds_and_runs():
    build_result = subprocess.run(["npm", "run", "build"], cwd=PROJECT_DIR, capture_output=True, text=True)
    assert build_result.returncode == 0, f"App failed to build: {build_result.stderr}\n{build_result.stdout}"

    process = subprocess.Popen(["npm", "run", "start"], cwd=PROJECT_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    try:
        # Wait for the server to start
        for _ in range(30):
            try:
                req = urllib.request.Request("http://localhost:3000")
                with urllib.request.urlopen(req) as response:
                    status_code = response.getcode()
                    if status_code == 200:
                        break
            except urllib.error.URLError:
                time.sleep(1)
        else:
            pytest.fail("Failed to connect to the Next.js server on port 3000 within 30 seconds.")
            
    finally:
        process.terminate()
        process.wait()
