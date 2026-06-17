import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_project_exists():
    """Check that the project directory exists."""
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} not found."

def test_convex_action_hash_generate():
    """Create and run a Node.js script to verify the Convex action."""
    verify_script_path = os.path.join(PROJECT_DIR, "verify.js")
    
    script_content = """
const { ConvexHttpClient } = require("convex/browser");
const client = new ConvexHttpClient(process.env.CONVEX_URL);
client.action("hash:generate", { text: "test-string" }).then(res => {
  if (res === "ffe65f1d98fafedea3514adc956c8ada5980c6c5d2552fd61f48401aefd5c00e") {
    console.log("SUCCESS");
  } else {
    console.log("FAILED: " + res);
    process.exit(1);
  }
}).catch(err => {
  console.error(err);
  process.exit(1);
});
"""
    
    with open(verify_script_path, "w") as f:
        f.write(script_content)
        
    result = subprocess.run(
        ["node", "verify.js"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    
    assert result.returncode == 0, f"verify.js failed with error: {result.stderr}"
    assert "SUCCESS" in result.stdout, f"Expected SUCCESS in output, got: {result.stdout}"
