import json
from e2b import Sandbox

def main():
    # 1. Create a new sandbox environment with a long timeout (1 hour / 3600 seconds)
    # to keep it alive.
    print("Creating a new sandbox environment...")
    sandbox = Sandbox.create(timeout=3600)
    sandbox_id = sandbox.sandbox_id
    print(f"Sandbox created with ID: {sandbox_id}")

    try:
        # 2. Create the directory /etc/custom_nginx/ in the sandbox
        print("Creating directory /etc/custom_nginx/ in the sandbox...")
        sandbox.files.make_dir("/etc/custom_nginx")

        # 3. Write the configuration file /etc/custom_nginx/nginx.conf
        nginx_conf_content = """server {
    listen 8080;
    server_name localhost;
    location / {
        root /var/www/html;
        index index.html;
    }
}
"""
        print("Writing nginx.conf inside the sandbox...")
        sandbox.files.write("/etc/custom_nginx/nginx.conf", nginx_conf_content)

        # 4. Write a JSON file to /home/user/e2b_task_info.json on the host machine containing sandbox_id
        task_info_path = "/home/user/e2b_task_info.json"
        print(f"Writing task info to {task_info_path} on the host...")
        with open(task_info_path, "w") as f:
            json.dump({"sandbox_id": sandbox_id}, f, indent=4)

        print("Provisioning completed successfully!")
    except Exception as e:
        print(f"Error during provisioning: {e}")
        raise e

if __name__ == "__main__":
    main()
