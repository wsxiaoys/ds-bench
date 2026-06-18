import os
import json
import time
from e2b import Sandbox

def main():
    sandbox = Sandbox.create(timeout=600)
    
    # Write index.html
    sandbox.files.write("/home/user/index.html", "Hello from E2B Sandbox!")
    
    # Start server in background
    sandbox.commands.run("python3 -m http.server 8000", background=True)
    
    # Wait a moment for server to start
    time.sleep(2)
    
    # Get host and format URL
    host = sandbox.get_host(8000)
    url = f"https://{host}"
    
    # Save info
    info = {
        "sandbox_id": sandbox.sandbox_id,
        "url": url
    }
    
    with open("/home/user/e2b_task_info.json", "w") as f:
        json.dump(info, f)
        
    print(f"Server started at {url}")
    # Keep the script running a bit to allow sandbox to stay alive
    # Actually, E2B sandbox stays alive until timeout anyway, but just in case
    sandbox.keep_alive(600)

if __name__ == "__main__":
    main()
