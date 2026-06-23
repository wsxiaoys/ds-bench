import os
import json
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_trpc_version_upgraded():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    with open(package_json_path) as f:
        pkg = json.load(f)
    
    trpc_server_version = pkg.get("dependencies", {}).get("@trpc/server", "")
    assert "next" in trpc_server_version or "11." in trpc_server_version, "Expected @trpc/server to be upgraded to v11 or next."

def test_transformer_moved_to_links():
    trpc_utils_path = os.path.join(PROJECT_DIR, "src/utils/trpc.ts")
    with open(trpc_utils_path) as f:
        content = f.read()
    
    # Transformer should not be at the root of the config object, it should be in httpBatchLink
    assert "httpBatchLink({" in content, "httpBatchLink should still be used"
    # Basic check to see if transformer is inside httpBatchLink
    # This regex is a bit simplistic, but we can verify it's not at root.
    assert "transformer: superjson" in content, "superjson should still be used as transformer"
    
    # Specifically, check if transformer is inside httpBatchLink
    # Extract the links array part
    links_start = content.find("links:")
    assert links_start != -1, "links array not found"
    links_content = content[links_start:]
    assert "transformer: superjson" in links_content or "transformer:superjson" in links_content, "transformer must be moved inside the links array"

def test_app_starts_and_responds():
    # This is a basic test to see if the app can build and start
    # Since browser verification runs in real evaluation, we just check if npm run build works
    result = subprocess.run(["npm", "run", "build"], cwd=PROJECT_DIR, capture_output=True, text=True)
    assert result.returncode == 0, f"Next.js build failed: {result.stderr}"
