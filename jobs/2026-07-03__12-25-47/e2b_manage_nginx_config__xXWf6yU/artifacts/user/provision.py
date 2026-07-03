import os
import json
import time
from e2b import Sandbox

# Create a new sandbox environment
sandbox = Sandbox.create()

# Create the directory /etc/custom_nginx/ (needs sudo because sandbox user isn't root)
sandbox.commands.run('sudo mkdir -p /etc/custom_nginx/')

# Nginx configuration content
nginx_config = """server {
    listen 8080;
    server_name localhost;
    location / {
        root /var/www/html;
        index index.html;
    }
}"""

# Write the file to /tmp in the sandbox first, then move with sudo
sandbox.files.write('/tmp/nginx.conf', nginx_config)
sandbox.commands.run('sudo cp /tmp/nginx.conf /etc/custom_nginx/nginx.conf')

# Read it back to verify using sandbox.files.read with sudo cat via commands
result = sandbox.commands.run('sudo cat /etc/custom_nginx/nginx.conf')
read_back = result.stdout
print("=== Content read back from sandbox ===")
print(read_back)
print("=== End of content ===")

# Write the sandbox_id to the JSON file on the host machine
task_info = {
    "sandbox_id": sandbox.sandbox_id
}
with open('/home/user/e2b_task_info.json', 'w') as f:
    json.dump(task_info, f, indent=2)

print(f"Sandbox ID: {sandbox.sandbox_id}")
print(f"JSON info written to /home/user/e2b_task_info.json")

# Keep the sandbox alive with a long timeout
sandbox.set_timeout(3600)

# Wait to keep the script alive so the sandbox persists
print("Sandbox is alive. Sleeping to keep it running...")
time.sleep(60)
