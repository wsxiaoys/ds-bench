#!/bin/bash

cat << 'EOF' > solve.py
import os
import json
from e2b import Sandbox

def main():
    sandbox = Sandbox(
        envs={
            "SECRET_TOKEN": "super-secret-123",
            "API_ENDPOINT": "https://api.example.com"
        }
    )
    
    # Write the file inside sandbox
    sandbox.commands.run(
        "echo -e \"TOKEN=$SECRET_TOKEN\\nENDPOINT=$API_ENDPOINT\" > /home/user/env_dump.txt"
    )
    
    # Save sandbox ID locally
    with open("/home/user/e2b_task_info.json", "w") as f:
        json.dump({"sandbox_id": sandbox.id}, f)
        
    # We do NOT kill the sandbox as per instructions
    sandbox.set_timeout(300_000)

if __name__ == "__main__":
    main()
EOF

python3 solve.py
