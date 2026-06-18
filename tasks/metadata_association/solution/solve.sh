#!/bin/bash

cat << 'EOF' > /home/user/manage_sandbox.py
import json
from e2b import Sandbox

# 1 & 2: Create sandbox with metadata
sandbox = Sandbox.create(
    timeout=300,
    metadata={
        "user_id": "devops_user_99",
        "environment": "staging",
        "purpose": "infrastructure_testing"
    }
)

# 3: Write sandbox ID to file
with open("/home/user/sandbox_id.txt", "w") as f:
    f.write(sandbox.sandbox_id)

# 4: Retrieve list of running sandboxes
paginator = Sandbox.list()
running_sandboxes = paginator.next_items()

# 5: Find the sandbox
target_sandbox = None
for s in running_sandboxes:
    if s.sandbox_id == sandbox.sandbox_id:
        target_sandbox = s
        break

if target_sandbox:
    # 6: Write retrieved metadata as JSON
    with open("/home/user/retrieved_metadata.json", "w") as f:
        json.dump(target_sandbox.metadata, f, indent=2)

EOF

python3 /home/user/manage_sandbox.py
