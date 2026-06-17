import os
import subprocess
import requests
import pytest

PROJECT_DIR = "/home/user/project"

def test_webhook_and_query():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable not set"
    
    convex_url = os.environ.get("CONVEX_URL")
    assert convex_url, "CONVEX_URL environment variable not set"
    
    # HTTP actions are exposed on the .site domain instead of .cloud
    site_url = convex_url.replace(".cloud", ".site")
    webhook_url = f"{site_url}/webhook"
    
    payload = {
        "payload": "test_payload_data",
        "runId": run_id
    }
    
    resp = requests.post(webhook_url, json=payload)
    assert resp.status_code in [200, 201], f"Webhook POST failed with status {resp.status_code}: {resp.text}"
    
    # Create Node.js script to query the data
    script_content = """
const { ConvexHttpClient } = require("convex/browser");
const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function main() {
  const result = await client.query("webhooks:get_webhook", { runId: process.env.ZEALT_RUN_ID });
  if (!Array.isArray(result)) {
    console.error("Result is not an array:", result);
    process.exit(1);
  }
  const found = result.some(r => r.payload === "test_payload_data");
  if (!found) {
    console.error("Payload not found in result:", result);
    process.exit(1);
  }
  console.log("Success");
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
"""
    script_path = "/tmp/verify.js"
    with open(script_path, "w") as f:
        f.write(script_content)
        
    # Run the verification script in the project directory where `convex` should be installed
    result = subprocess.run(["node", script_path], capture_output=True, text=True, cwd=PROJECT_DIR)
    assert result.returncode == 0, f"Verification script failed:\\nSTDOUT: {result.stdout}\\nSTDERR: {result.stderr}"
