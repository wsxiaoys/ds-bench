import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session", autouse=True)
def setup_verify_script():
    """Set up the verify script and deploy it to Convex."""
    # Ensure npm install
    subprocess.run(["npm", "install"], cwd=PROJECT_DIR, check=True)
    
    # Write verify.ts
    convex_dir = os.path.join(PROJECT_DIR, "convex")
    os.makedirs(convex_dir, exist_ok=True)
    verify_ts_path = os.path.join(convex_dir, "verify.ts")
    with open(verify_ts_path, "w") as f:
        f.write("""import { query } from "./_generated/server";
import { v } from "convex/values";
export const getByRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("tasks").filter(q => q.eq(q.field("runId"), args.runId)).collect();
  }
});
""")
    
    # Deploy verify script
    result = subprocess.run(
        ["npx", "convex", "deploy"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Failed to deploy verify script: {result.stderr}"

def test_rust_cli_execution():
    """Run the Rust CLI to insert a task."""
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run-id")
    
    # Run the rust client
    result = subprocess.run(
        ["cargo", "run", "--manifest-path", "rust-client/Cargo.toml", "--", "Hello Convex"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Rust CLI execution failed: {result.stderr}"

def test_convex_mutation_result():
    """Verify the mutation result using ConvexHttpClient in Node.js."""
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run-id")
    
    # Write verify.js
    verify_js_path = os.path.join(PROJECT_DIR, "verify.js")
    with open(verify_js_path, "w") as f:
        f.write("""const { ConvexHttpClient } = require("convex/browser");
const client = new ConvexHttpClient(process.env.CONVEX_URL);
client.query("verify:getByRunId", { runId: process.env.ZEALT_RUN_ID }).then(res => console.log(JSON.stringify(res))).catch(err => { console.error(err); process.exit(1); });
""")
    
    # Run verify.js
    result = subprocess.run(
        ["node", "verify.js"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Failed to run verify.js: {result.stderr}"
    
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse verify.js output as JSON: {result.stdout}")
        
    assert isinstance(data, list), "Expected output to be a JSON array"
    
    found = False
    for item in data:
        if item.get("text") == "Hello Convex" and item.get("runId") == run_id:
            found = True
            break
            
    assert found, f"Could not find task with text 'Hello Convex' and runId '{run_id}' in the database. Got: {data}"
