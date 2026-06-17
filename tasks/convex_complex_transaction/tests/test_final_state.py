import os
import subprocess
import pytest

def test_deploy_log_exists():
    log_path = "/home/user/myproject/deploy.log"
    assert os.path.isfile(log_path), f"Deploy log not found at {log_path}"

def test_convex_transactions():
    run_id = os.environ.get("ZEALT_RUN_ID", "default-run-id")
    
    script_content = f"""
const {{ ConvexHttpClient }} = require("convex/browser");
const client = new ConvexHttpClient(process.env.CONVEX_URL);

async function main() {{
    const runId = "{run_id}";
    const alice = `alice-${{runId}}`;
    const bob = `bob-${{runId}}`;

    // 3. Create accounts
    await client.mutation("accounts:createAccount", {{ name: alice, initialBalance: 100 }});
    await client.mutation("accounts:createAccount", {{ name: bob, initialBalance: 50 }});

    // 4. Transfer 30 from alice to bob
    await client.mutation("accounts:transfer", {{ fromName: alice, toName: bob, amount: 30 }});

    // 5. Verify balances
    let aliceBalance = await client.query("accounts:getBalance", {{ name: alice }});
    let bobBalance = await client.query("accounts:getBalance", {{ name: bob }});
    if (aliceBalance !== 70) throw new Error(`Alice balance is ${{aliceBalance}}, expected 70`);
    if (bobBalance !== 80) throw new Error(`Bob balance is ${{bobBalance}}, expected 80`);

    // 6. Transfer 100 from alice to bob (should fail)
    let failed = false;
    try {{
        await client.mutation("accounts:transfer", {{ fromName: alice, toName: bob, amount: 100 }});
    }} catch (e) {{
        failed = true;
    }}
    if (!failed) throw new Error("Expected transfer of 100 to fail due to insufficient funds");

    // 7. Verify balances are rolled back
    aliceBalance = await client.query("accounts:getBalance", {{ name: alice }});
    bobBalance = await client.query("accounts:getBalance", {{ name: bob }});
    if (aliceBalance !== 70) throw new Error(`Alice balance is ${{aliceBalance}}, expected 70`);
    if (bobBalance !== 80) throw new Error(`Bob balance is ${{bobBalance}}, expected 80`);

    // 8. Transfer -10 (should fail)
    failed = false;
    try {{
        await client.mutation("accounts:transfer", {{ fromName: alice, toName: bob, amount: -10 }});
    }} catch (e) {{
        failed = true;
    }}
    if (!failed) throw new Error("Expected transfer of -10 to fail");
}}

main().catch(e => {{
    console.error(e);
    process.exit(1);
}});
"""
    
    script_path = "/tmp/verify.js"
    with open(script_path, "w") as f:
        f.write(script_content)
        
    env = os.environ.copy()
    
    result = subprocess.run(
        ["node", script_path],
        cwd="/home/user/myproject",
        env=env,
        capture_output=True,
        text=True
    )
    
    assert result.returncode == 0, f"Verification script failed: {result.stderr}\\n{result.stdout}"
