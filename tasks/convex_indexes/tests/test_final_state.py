import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_deployment_log_exists():
    log_file = os.path.join(PROJECT_DIR, "output.log")
    assert os.path.isfile(log_file), f"Log file {log_file} does not exist"
    with open(log_file, "r") as f:
        content = f.read()
    assert "Deployed successfully" in content, "Log file does not contain 'Deployed successfully'"

def test_convex_queries_and_mutations():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable is missing"
    
    convex_url = os.environ.get("CONVEX_URL")
    assert convex_url, "CONVEX_URL environment variable is missing"
    
    js_script = f"""
import {{ ConvexHttpClient }} from 'convex/browser';

async function verify() {{
    const client = new ConvexHttpClient('{convex_url}');
    const runId = '{run_id}';
    
    // Call the mutation
    await client.mutation('products:seed', {{ runId }});
    
    // Call getByCategory
    const byCategory = await client.query('products:getByCategory', {{ runId, category: 'Electronics' }});
    if (!Array.isArray(byCategory)) {{
        throw new Error('getByCategory did not return an array');
    }}
    const hasCategory = byCategory.some(p => p.price === 500) && byCategory.some(p => p.price === 1500);
    if (!hasCategory) {{
        throw new Error('getByCategory did not return the expected products');
    }}
    
    // Call getCheapByCategory
    const cheap = await client.query('products:getCheapByCategory', {{ runId, category: 'Electronics', maxPrice: 1000 }});
    if (!Array.isArray(cheap)) {{
        throw new Error('getCheapByCategory did not return an array');
    }}
    const hasCheap = cheap.some(p => p.price === 500);
    const hasExpensive = cheap.some(p => p.price === 1500);
    if (!hasCheap || hasExpensive) {{
        throw new Error('getCheapByCategory did not filter correctly');
    }}
    
    console.log('SUCCESS');
}}

verify().catch(err => {{
    console.error(err);
    process.exit(1);
}});
"""
    
    js_file = "/tmp/verify.mjs"
    with open(js_file, "w") as f:
        f.write(js_script)
        
    result = subprocess.run(["node", js_file], capture_output=True, text=True, cwd=PROJECT_DIR)
    assert result.returncode == 0, f"Node verification script failed: {result.stderr}\\n{result.stdout}"
    assert "SUCCESS" in result.stdout, "Node verification script did not print SUCCESS"
