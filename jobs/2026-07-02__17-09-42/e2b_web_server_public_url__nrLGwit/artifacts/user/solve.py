"""
Spin up a Python HTTP server inside an E2B sandbox and expose it via a public URL.

Steps performed:
1. Create a new E2B sandbox.
2. Write an `index.html` file with the exact content "Hello from E2B Sandbox!".
3. Start a Python HTTP server (in the background) on port 8000 serving /home/user.
4. Retrieve the public host for port 8000 and build the full https URL.
5. Persist `sandbox_id` and the full public URL to /home/user/e2b_task_info.json
   on the LOCAL machine.
6. Keep the sandbox alive for at least 5 minutes (default E2B sandbox timeout is
   300 seconds; we additionally extend it to be safe).
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from e2b import Sandbox


INDEX_HTML_CONTENT = "Hello from E2B Sandbox!"
LOCAL_INFO_PATH = Path("/home/user/e2b_task_info.json")
INSIDE_SANDBOX_DIR = "/home/user"
INSIDE_INDEX_HTML = f"{INSIDE_SANDBOX_DIR}/index.html"
HTTP_PORT = 8000

# At least 5 minutes (in seconds). Add a buffer so the sandbox doesn't shut down
# mid-task while verification is being performed.
SANDBOX_TIMEOUT_SECONDS = 5 * 60 + 30  # 5 minutes 30 seconds


def main() -> int:
    print("[solve] Creating E2B sandbox...", flush=True)
    sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT_SECONDS)
    print(f"[solve] Sandbox created: {sandbox.sandbox_id}", flush=True)

    try:
        # 1. Write index.html inside the sandbox.
        print(
            f"[solve] Writing index.html to {INSIDE_INDEX_HTML} inside sandbox...",
            flush=True,
        )
        sandbox.files.write(INSIDE_INDEX_HTML, INDEX_HTML_CONTENT)
        # Verify the file was written correctly.
        read_back = sandbox.files.read(INSIDE_INDEX_HTML)
        if read_back != INDEX_HTML_CONTENT:
            raise RuntimeError(
                f"index.html content mismatch: wrote {INDEX_HTML_CONTENT!r}, "
                f"read back {read_back!r}"
            )

        # 2. Make sure the target directory exists (it should by default, but be safe).
        sandbox.commands.run(f"mkdir -p {INSIDE_SANDBOX_DIR}")

        # 3. Start a Python HTTP server in the background, serving /home/user.
        http_cmd = (
            f"cd {INSIDE_SANDBOX_DIR} && "
            f"nohup python3 -m http.server {HTTP_PORT} "
            f"--directory {INSIDE_SANDBOX_DIR} "
            "> /tmp/http_server.log 2>&1 &"
        )
        print(f"[solve] Starting HTTP server: {http_cmd}", flush=True)
        sandbox.commands.run(http_cmd, background=True)

        # Give the server a moment to bind to the port.
        print("[solve] Waiting briefly for HTTP server to bind...", flush=True)
        time.sleep(3)

        # Confirm the server is running by curling localhost inside the sandbox.
        check = sandbox.commands.run(
            f"curl -sS -o /dev/null -w '%{{http_code}}' "
            f"http://127.0.0.1:{HTTP_PORT}/index.html || true"
        )
        print(
            f"[solve] Local HTTP status code from inside sandbox: "
            f"{check.stdout.strip()}",
            flush=True,
        )

        # 4. Retrieve the public host for port 8000 and build the full https URL.
        host = sandbox.get_host(HTTP_PORT)
        public_url = f"https://{host}"
        print(f"[solve] Public URL: {public_url}", flush=True)

        # 5. Persist sandbox_id and full public URL on the LOCAL machine.
        payload = {
            "sandbox_id": sandbox.sandbox_id,
            "url": public_url,
        }
        LOCAL_INFO_PATH.write_text(json.dumps(payload, indent=2))
        print(f"[solve] Wrote local info to {LOCAL_INFO_PATH}", flush=True)
        print(f"[solve] Contents: {LOCAL_INFO_PATH.read_text()}", flush=True)

        # 6. Keep the sandbox alive for at least 5 minutes.
        # The sandbox was created with a >5-minute timeout. Extend it to be safe,
        # then sleep so this process (which owns the sandbox reference) is alive.
        sandbox.set_timeout(SANDBOX_TIMEOUT_SECONDS)
        keep_alive_seconds = 5 * 60  # 5 minutes
        print(
            f"[solve] Keeping sandbox alive for ~{keep_alive_seconds} seconds...",
            flush=True,
        )
        time.sleep(keep_alive_seconds)

        print("[solve] Done. Sandbox kept alive as requested.", flush=True)
        return 0
    except Exception as exc:
        print(f"[solve] ERROR: {exc!r}", flush=True)
        # Even on error, try to dump what we have to help debugging.
        try:
            payload = {
                "sandbox_id": sandbox.sandbox_id,
                "url": f"https://{sandbox.get_host(HTTP_PORT)}",
            }
            LOCAL_INFO_PATH.write_text(json.dumps(payload, indent=2))
        except Exception:
            pass
        return 1


if __name__ == "__main__":
    sys.exit(main())
