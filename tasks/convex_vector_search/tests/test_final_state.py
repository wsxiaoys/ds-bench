import os
import subprocess
import json
import time
import pytest

PROJECT_DIR = "/home/user/convex-project"

def test_convex_vector_search():
    """Verify Convex vector search works correctly."""
    run_id = os.environ.get("ZEALT_RUN_ID", "test-run-id")
    
    # Write a Node.js script to interact with the Convex backend
    script_path = os.path.join(PROJECT_DIR, "verify_vector_search.js")
    script_content = f"""
const {{ ConvexHttpClient }} = require("convex/browser");
const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function run() {{
  const runId = "{run_id}";
  
  try {{
      const id1 = await client.mutation("foods:insert", {{ runId, text: "apple", embedding: [1.0, 0.0, 0.0] }});
      const id2 = await client.mutation("foods:insert", {{ runId, text: "banana", embedding: [0.9, 0.1, 0.0] }});
      const id3 = await client.mutation("foods:insert", {{ runId, text: "car", embedding: [0.0, 0.0, 1.0] }});
      
      // Wait for vector index to update
      await new Promise(r => setTimeout(r, 4000));
      
      const results = await client.action("foods:searchSimilar", {{ runId, vector: [1.0, 0.0, 0.0] }});
      
      console.log(JSON.stringify({{ success: true, id1, id2, id3, results }}));
  }} catch (e) {{
      console.log(JSON.stringify({{ success: false, error: e.message }}));
  }}
}}
run();
"""
    
    with open(script_path, "w") as f:
        f.write(script_content)
        
    # Run the script
    result = subprocess.run(
        ["node", "verify_vector_search.js"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 0, f"Node script failed to execute: {result.stderr}"
    
    try:
        output = json.loads(result.stdout.strip())
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse script output. Raw output: {result.stdout}")
        
    assert output.get("success") is True, f"Script encountered an error: {output.get('error')}"
    
    id1 = output["id1"]
    id2 = output["id2"]
    results = output["results"]
    
    assert isinstance(results, list), f"Expected results to be an array, got {type(results)}"
    assert len(results) == 2, f"Expected 2 results, got {len(results)}"
    
    result_ids = [r["_id"] for r in results]
    assert id1 in result_ids, f"Expected id1 ({id1}) to be in results, but got {result_ids}"
    assert id2 in result_ids, f"Expected id2 ({id2}) to be in results, but got {result_ids}"
