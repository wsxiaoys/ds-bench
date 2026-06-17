#!/bin/bash

# Create a python script to solve the task
cat << 'EOF' > /home/user/solve.py
import os
import json
from e2b import Sandbox

def main():
    # Create the sandbox
    sandbox = Sandbox()
    sandbox_id = sandbox.sandbox_id
    
    # Save the sandbox ID
    with open("/home/user/e2b_task_info.json", "w") as f:
        json.dump({"sandbox_id": sandbox_id}, f)
        
    # Create the bash script
    script_content = """#!/bin/bash
echo 'Initializing...'
sleep 1
echo 'Running background job...'
sleep 1
echo 'Job complete.'
"""
    sandbox.files.write("/home/user/task.sh", script_content)
    
    # Make it executable
    sandbox.commands.run("chmod +x /home/user/task.sh")
    
    # Run as background command
    background_cmd = sandbox.commands.run("/home/user/task.sh", background=True)
    
    # Wait for the command to finish
    result = background_cmd.wait()
    
    # Get stdout
    stdout = result.stdout
    
    # Write stdout to a file inside the sandbox
    sandbox.files.write("/home/user/captured_stdout.txt", stdout)
    
    # Keep sandbox running (sandbox will timeout eventually or E2B handles it)
    sandbox.keep_alive(600)

if __name__ == "__main__":
    main()
EOF

# Run the python script
python3 /home/user/solve.py
