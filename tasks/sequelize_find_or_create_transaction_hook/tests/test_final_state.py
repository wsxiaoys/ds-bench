import os
import subprocess
import json
import pytest

PROJECT_DIR = "/home/user/myproject"

def test_find_or_create_transaction_hook():
    """Verify that the hooks and transactions work as described."""
    test_script_path = os.path.join(PROJECT_DIR, "verify_task.js")
    
    node_script = """
    const path = require('path');
    
    async function runTest() {
        try {
            const { initDB, runFindOrCreate, AuditLog } = require('./index.js');
            
            // Step 2: Call initDB
            await initDB();
            
            // Step 3: Call runFindOrCreate('normal_user')
            await runFindOrCreate('normal_user');
            
            // Step 4: Query AuditLog for 'normal_user'
            const normalLog = await AuditLog.findOne({ where: { username: 'normal_user' } });
            if (!normalLog || normalLog.action !== 'Creating user') {
                throw new Error("AuditLog for 'normal_user' not found or incorrect action.");
            }
            
            // Step 5: Call runFindOrCreate('error_user')
            let errorCaught = false;
            try {
                const res = await runFindOrCreate('error_user');
                if (res instanceof Error) {
                    errorCaught = true;
                }
            } catch (err) {
                errorCaught = true;
            }
            
            // Step 6: Query AuditLog for 'error_user'
            const errorLog = await AuditLog.findOne({ where: { username: 'error_user' } });
            if (errorLog) {
                throw new Error("AuditLog for 'error_user' was found! Transaction rollback failed.");
            }
            
            console.log(JSON.stringify({ success: true, errorCaught }));
        } catch (e) {
            console.error(e.message);
            process.exit(1);
        }
    }
    
    runTest();
    """
    
    with open(test_script_path, "w") as f:
        f.write(node_script)
        
    result = subprocess.run(
        ["node", "verify_task.js"],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR
    )
    
    assert result.returncode == 0, f"Verification script failed: {result.stderr or result.stdout}"
    
    try:
        output = json.loads(result.stdout.strip())
        assert output.get("success") is True, "Verification script did not report success."
    except json.JSONDecodeError:
        pytest.fail(f"Failed to parse verification output as JSON: {result.stdout}")
