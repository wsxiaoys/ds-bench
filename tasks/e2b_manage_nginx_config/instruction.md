You are a DevOps engineer automating infrastructure provisioning. Write a Python script `/home/user/provision.py` that uses the E2B Python SDK to create a new sandbox environment. Inside this sandbox, create a directory `/etc/custom_nginx/`. Then, write a configuration file `/etc/custom_nginx/nginx.conf` with the following content:

```nginx
server {
    listen 8080;
    server_name localhost;
    location / {
        root /var/www/html;
        index index.html;
    }
}
```

After writing the script, read it back to verify the content, and then execute it immediately. Finally, keep the sandbox alive (e.g., by setting a long timeout or not killing it), and write a JSON file to `/home/user/e2b_task_info.json` on the host machine containing the created `sandbox_id`.

Assume the `E2B_API_KEY` is already set in the environment.