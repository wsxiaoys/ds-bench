#!/bin/bash
cat << 'EOF' > /home/user/solve.py
from e2b import Sandbox

def main():
    sbx = Sandbox(timeout=600)
    sbx.commands.run("echo 'Hello E2B' > /home/user/hello.txt")
    
    with open("/home/user/sandbox_id.txt", "w") as f:
        f.write(sbx.sandbox_id)
        
    sbx.keep_alive(600)

if __name__ == "__main__":
    main()
EOF

python3 /home/user/solve.py
