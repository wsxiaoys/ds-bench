import json
import os
import time
from e2b import Sandbox

def main():
    print("Creating a new E2B sandbox...")
    # Create a new E2B sandbox with a timeout of 10 minutes (600 seconds)
    # This ensures it stays alive for at least 5 minutes.
    sandbox = Sandbox.create(timeout=600)
    
    try:
        sandbox_id = sandbox.sandbox_id
        print(f"Sandbox created with ID: {sandbox_id}")
        
        # 2. Writes an index.html file in /home/user/ containing the exact text Hello from E2B Sandbox!
        print("Writing index.html inside the sandbox...")
        sandbox.files.write("/home/user/index.html", "Hello from E2B Sandbox!")
        
        # 3. Starts a Python HTTP server in the background inside the sandbox on port 8000, serving the /home/user/ directory.
        print("Starting Python HTTP server in background on port 8000...")
        sandbox.commands.run("python3 -m http.server 8000 --directory /home/user/", background=True)
        
        # Give the server a moment to start up
        time.sleep(2)
        
        # 4. Retrieves the public URL for port 8000 using the SDK.
        host = sandbox.get_host(8000)
        public_url = f"https://{host}"
        print(f"Public URL for port 8000: {public_url}")
        
        # 5. Saves the sandbox ID and the full public URL (e.g. https://<host>) as a JSON object in /home/user/e2b_task_info.json on the local machine.
        # The JSON object should have the keys sandbox_id and url.
        task_info = {
            "sandbox_id": sandbox_id,
            "url": public_url
        }
        
        local_json_path = "/home/user/e2b_task_info.json"
        print(f"Saving task info to local machine at: {local_json_path}")
        with open(local_json_path, "w") as f:
            json.dump(task_info, f, indent=2)
            
        # 6. Ensure the sandbox is kept alive for at least 5 minutes so we can verify the URL.
        # We will sleep for 5 minutes (300 seconds) to keep the script running and the sandbox alive.
        # Let's sleep in a loop so we can print progress.
        sleep_duration = 310
        print(f"Keeping the sandbox alive for {sleep_duration} seconds (over 5 minutes)...")
        for i in range(sleep_duration):
            if i > 0 and i % 60 == 0:
                print(f"Kept alive for {i} seconds so far...")
            time.sleep(1)
            
        print("5 minutes have passed. Script exiting.")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        raise e

if __name__ == "__main__":
    main()
