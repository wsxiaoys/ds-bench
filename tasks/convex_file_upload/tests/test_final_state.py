import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/project"

def test_convex_deployment():
    """Verify that the Convex backend is deployed and functions work."""
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run-id")
    convex_url = os.environ.get("CONVEX_URL")
    assert convex_url, "CONVEX_URL environment variable is not set."

    test_script = """import { ConvexHttpClient } from "convex/browser";

async function main() {
    const url = process.env.CONVEX_URL;
    const client = new ConvexHttpClient(url);
    const runId = process.env.ZEALT_RUN_ID || "test-run-id";
    
    // 1. Generate upload URL
    const uploadUrl = await client.mutation("files:generateUploadUrl");
    if (!uploadUrl || typeof uploadUrl !== "string") {
        throw new Error("generateUploadUrl did not return a valid URL");
    }
    
    // 2. Upload file
    const res = await fetch(uploadUrl, {
        method: "POST",
        body: "dummy content",
        headers: { "Content-Type": "text/plain" }
    });
    if (!res.ok) {
        throw new Error("Failed to upload file to generated URL");
    }
    const { storageId } = await res.json();
    
    // 3. Save file
    await client.mutation("files:saveFile", { storageId, title: "Test File", runId });
    
    // 4. List files
    const files = await client.query("files:listFiles", { runId });
    
    console.log(JSON.stringify(files));
}
main().catch(e => { console.error(e); process.exit(1); });
"""

    script_path = os.path.join(PROJECT_DIR, "test.mjs")
    with open(script_path, "w") as f:
        f.write(test_script)

    result = subprocess.run(
        ["node", "test.mjs"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=os.environ.copy()
    )

    assert result.returncode == 0, f"Test script failed: {result.stderr}"

    try:
        files = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse output as JSON: {result.stdout}")

    assert isinstance(files, list), "Expected listFiles to return an array"
    assert len(files) > 0, "Expected at least one file to be returned"
    
    test_file = next((f for f in files if f.get("title") == "Test File"), None)
    assert test_file is not None, "Saved file 'Test File' not found in listFiles result"
    
    url = test_file.get("url")
    assert url and url.startswith("https://"), f"Expected a valid url starting with https://, got: {url}"
