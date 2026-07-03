#!/usr/bin/env python3
"""
provision.py

Provisions an E2B sandbox environment:
  1. Creates a new sandbox with a long timeout (kept alive, not killed).
  2. Creates the directory /etc/custom_nginx/ inside the sandbox.
  3. Writes the nginx configuration file /etc/custom_nginx/nginx.conf.
  4. Reads the file back from the sandbox to verify its content.
  5. Writes the created sandbox_id to /home/user/e2b_task_info.json on the host.

Assumes E2B_API_KEY is present in the environment.
"""

import json
import sys
import os

from e2b import Sandbox

# The nginx configuration that must be written inside the sandbox.
NGINX_CONF = """server {
    listen 8080;
    server_name localhost;
    location / {
        root /var/www/html;
        index index.html;
    }
}
"""

# Paths used inside the sandbox.
REMOTE_DIR = "/etc/custom_nginx"
REMOTE_CONF = "/etc/custom_nginx/nginx.conf"

# Path on the host machine where the sandbox id is persisted.
HOST_INFO_PATH = "/home/user/e2b_task_info.json"

# Keep the sandbox alive for 30 minutes. We intentionally do NOT call
# sandbox.kill() so the sandbox remains running after the script exits.
SANDBOX_TIMEOUT_SECONDS = 1800


def main() -> int:
    # Make sure the API key is available before doing any work.
    if not os.environ.get("E2B_API_KEY"):
        print("ERROR: E2B_API_KEY is not set in the environment.", file=sys.stderr)
        return 1

    print("Creating a new E2B sandbox (timeout=%ss)..." % SANDBOX_TIMEOUT_SECONDS)
    sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT_SECONDS)
    sandbox_id = sandbox.sandbox_id
    print("Sandbox created. sandbox_id =", sandbox_id)

    try:
        # 1. Create the /etc/custom_nginx/ directory inside the sandbox.
        print("Creating directory:", REMOTE_DIR)
        sandbox.files.make_dir(REMOTE_DIR)

        # 2. Write the nginx.conf file inside the sandbox.
        print("Writing configuration file:", REMOTE_CONF)
        sandbox.files.write(REMOTE_CONF, NGINX_CONF)

        # 3. Read the file back from the sandbox to verify its content.
        print("Reading back", REMOTE_CONF, "for verification...")
        read_back = sandbox.files.read(REMOTE_CONF, format="text")

        if read_back != NGINX_CONF:
            print("ERROR: Verification failed. File content does not match.",
                  file=sys.stderr)
            print("---- expected ----", file=sys.stderr)
            print(NGINX_CONF, file=sys.stderr)
            print("---- actual ----", file=sys.stderr)
            print(read_back, file=sys.stderr)
            return 2

        print("Verification successful: nginx.conf content matches.")
        print("---- nginx.conf ----")
        print(read_back)
        print("--------------------")

        # 4. Persist the sandbox_id to a JSON file on the host machine.
        task_info = {"sandbox_id": sandbox_id}
        with open(HOST_INFO_PATH, "w", encoding="utf-8") as fh:
            json.dump(task_info, fh, indent=2)
            fh.write("\n")
        print("Wrote sandbox id to", HOST_INFO_PATH)
        print(json.dumps(task_info, indent=2))

        # 5. Explicitly extend the timeout once more to keep the sandbox
        #    alive after the script exits. We deliberately do NOT kill it.
        sandbox.set_timeout(SANDBOX_TIMEOUT_SECONDS)
        print("Sandbox kept alive. sandbox_id =", sandbox_id)

        return 0

    except Exception as exc:  # noqa: BLE001 - top-level safety net
        print("ERROR during provisioning:", exc, file=sys.stderr)
        # Attempt to leave the sandbox running even on failure so it can be
        # inspected, but still surface the error to the caller.
        try:
            with open(HOST_INFO_PATH, "w", encoding="utf-8") as fh:
                json.dump({"sandbox_id": sandbox_id, "error": str(exc)},
                          fh, indent=2)
                fh.write("\n")
        except Exception:  # noqa: BLE001
            pass
        return 3


if __name__ == "__main__":
    sys.exit(main())