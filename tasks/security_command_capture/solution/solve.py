import json
from e2b import Sandbox

def main():
    # Create sandbox with timeout
    sandbox = Sandbox(timeout=600)
    
    # Create bash script
    script_content = """#!/bin/bash
echo 'Scanning open ports...'
echo 'Found vulnerable port 8080' >&2
echo 'Scan complete. 1 vulnerabilities found.'
"""
    sandbox.files.write("/home/user/scan_network.sh", script_content)
    
    # Make executable
    sandbox.commands.run("chmod +x /home/user/scan_network.sh")
    
    # Execute and capture
    result = sandbox.commands.run("/home/user/scan_network.sh")
    
    # Write results
    results_content = f"STDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}\n"
    sandbox.files.write("/home/user/scan_results.txt", results_content)
    
    # Save sandbox info locally
    with open("/home/user/e2b_task_info.json", "w") as f:
        json.dump({"sandbox_id": sandbox.sandbox_id}, f)
        
    # Keep sandbox alive so verifier can check it
    sandbox.keep_alive(600)

if __name__ == "__main__":
    main()
