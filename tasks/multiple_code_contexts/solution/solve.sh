#!/bin/bash

cat << 'EOF' > /workspace/solve.py
from e2b_code_interpreter import Sandbox

with Sandbox.create() as sandbox:
    ctx1 = sandbox.create_code_context()
    ctx2 = sandbox.create_code_context()
    
    sandbox.run_code("magic_number = 42", context=ctx1)
    sandbox.run_code("magic_number = 99", context=ctx2)
    
    sandbox.run_code("""
with open('/home/user/out1.txt', 'w') as f:
    f.write(str(magic_number))
""", context=ctx1)

    sandbox.run_code("""
with open('/home/user/out2.txt', 'w') as f:
    f.write(str(magic_number))
""", context=ctx2)

    out1 = sandbox.files.read('/home/user/out1.txt')
    out2 = sandbox.files.read('/home/user/out2.txt')
    
    with open('/workspace/host_out1.txt', 'w') as f:
        f.write(out1)
        
    with open('/workspace/host_out2.txt', 'w') as f:
        f.write(out2)
EOF

cd /workspace
python solve.py
