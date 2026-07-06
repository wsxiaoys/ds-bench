"""
Infrastructure provisioning script using the E2B Python SDK.

This script:
1. Creates a new E2B sandbox.
2. Creates /etc/custom_nginx/ inside the sandbox.
3. Writes an nginx configuration file at /etc/custom_nginx/nginx.conf.
4. Reads the file back to verify the content.
5. Keeps the sandbox alive (long timeout).
6. Writes the sandbox_id to /home/user/e2b_task_info.json on the host.
"""

import json
import os
from pathlib import Path

from e2b import Sandbox

HOST_INFO_PATH = Path("/home/user/e2b_task_info.json")
NGINX_CONFIG = """server {
    listen 8080;
    server_name localhost;
    location / {
        root /var/www/html;
        index index.html;
    }
}
"""

SANDBOX_KEEPALIVE_SECONDS = 60 * 60  # 1 hour


def main() -> None:
    # 1) Create a new sandbox. We pick a generous timeout so the sandbox
    #    stays alive after this script returns. The maximum keepalive is
    #    24h for Pro / 1h for Hobby; we use the max Hobby value.
    sandbox = Sandbox.create(timeout=SANDBOX_KEEPALIVE_SECONDS)
    print(f"[provision] Created sandbox with id: {sandbox.sandbox_id}")

    try:
        # 2) Create the target directory inside the sandbox. The sandbox
        #    default user (uid 1000) doesn't own /etc, so we elevate
        #    with sudo (passwordless for the `user` account).
        mkdir_result = sandbox.commands.run(
            "sudo mkdir -p /etc/custom_nginx && "
            "sudo chown user:user /etc/custom_nginx"
        )
        print(f"[provision] mkdir exit_code={mkdir_result.exit_code}")
        if mkdir_result.exit_code != 0:
            raise RuntimeError(
                f"Failed to create directory: {mkdir_result.stderr}"
            )

        # 3) Write the nginx configuration file.
        sandbox.files.write("/etc/custom_nginx/nginx.conf", NGINX_CONFIG)
        print("[provision] Wrote /etc/custom_nginx/nginx.conf")

        # 4) Read it back to verify.
        read_back = sandbox.files.read("/etc/custom_nginx/nginx.conf")
        print("[provision] Read back content:")
        print(read_back)

        if read_back != NGINX_CONFIG:
            raise RuntimeError(
                "Verification failed: file content does not match expected."
            )
        print("[provision] Verification OK: file content matches.")

        # 5) Persist the sandbox_id on the host so the caller can re-use it.
        info = {"sandbox_id": sandbox.sandbox_id}
        HOST_INFO_PATH.write_text(json.dumps(info, indent=2))
        print(f"[provision] Wrote sandbox info to {HOST_INFO_PATH}")

        # 6) Keep the sandbox alive for the full timeout. We explicitly
        #    set the timeout again to be safe and to make the intent
        #    obvious; this does NOT kill the sandbox.
        sandbox.set_timeout(SANDBOX_KEEPALIVE_SECONDS)
        print(
            f"[provision] Sandbox kept alive for "
            f"{SANDBOX_KEEPALIVE_SECONDS} seconds."
        )
    except Exception:
        # On failure, ensure we don't leak a half-configured sandbox.
        try:
            sandbox.kill()
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()