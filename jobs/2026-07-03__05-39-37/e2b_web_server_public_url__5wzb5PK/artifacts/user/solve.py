"""
Spin up a web server inside an E2B sandbox and expose it via a public URL.

Steps:
1. Create a new E2B sandbox (kept alive for ~10 minutes so it stays up for
   verification for at least 5 minutes after the script exits).
2. Write /home/user/index.html inside the sandbox with the exact text
   "Hello from E2B Sandbox!".
3. Start a Python HTTP server in the background inside the sandbox on port
   8000, serving the /home/user/ directory.
4. Retrieve the public URL for port 8000 using the SDK.
5. Save {"sandbox_id": ..., "url": ...} as JSON to /home/user/e2b_task_info.json
   on the LOCAL machine.
6. Keep the sandbox alive long enough (timeout) for the URL to be verified.
"""

import json
import time
import urllib.request

from e2b import Sandbox

PORT = 8000
SERVE_DIR = "/home/user"
HTML_PATH = f"{SERVE_DIR}/index.html"
HTML_CONTENT = "Hello from E2B Sandbox!"
LOCAL_INFO_PATH = "/home/user/e2b_task_info.json"

# Keep the sandbox alive for 10 minutes (600s) so that even after the script
# finishes there are well over 5 minutes available to verify the public URL.
SANDBOX_TIMEOUT_SECONDS = 600


def main() -> None:
    print("Creating E2B sandbox...")
    sandbox = Sandbox.create(timeout=SANDBOX_TIMEOUT_SECONDS)
    sandbox_id = sandbox.sandbox_id
    print(f"Sandbox created: {sandbox_id}")

    try:
        # 2. Write the index.html file inside the sandbox.
        print(f"Writing {HTML_PATH} inside the sandbox...")
        sandbox.files.write(HTML_PATH, HTML_CONTENT)

        # Verify the file contents are exactly what we wrote.
        written = sandbox.files.read(HTML_PATH)
        if isinstance(written, bytes):
            written = written.decode("utf-8")
        assert written == HTML_CONTENT, (
            f"File content mismatch: expected {HTML_CONTENT!r}, got {written!r}"
        )
        print("index.html written and verified.")

        # 3. Start a Python HTTP server in the background on port 8000.
        print(f"Starting HTTP server on port {PORT} serving {SERVE_DIR}...")
        sandbox.commands.run(
            f"python3 -m http.server {PORT} --bind 0.0.0.0",
            background=True,
            cwd=SERVE_DIR,
            timeout=0,  # no connection-time limit for the background process
        )

        # Give the server a moment to bind to the port, then wait for it.
        print("Waiting for the HTTP server to be ready...")
        _wait_for_port(sandbox, PORT)

        # 4. Retrieve the public URL for port 8000 using the SDK.
        host = sandbox.get_host(PORT)
        url = f"https://{host}"
        print(f"Public URL: {url}")

        # Verify the URL actually serves our content (best-effort).
        _verify_url_serves(url, HTML_CONTENT)

        # 5. Save sandbox ID and full public URL as JSON on the LOCAL machine.
        info = {"sandbox_id": sandbox_id, "url": url}
        with open(LOCAL_INFO_PATH, "w") as f:
            json.dump(info, f, indent=2)
        print(f"Saved info to {LOCAL_INFO_PATH}: {json.dumps(info)}")

        # 6. The sandbox timeout (600s) keeps it alive for ~10 minutes, which is
        # well over the 5-minute verification window. We refresh the timeout
        # to be safe and keep the script running briefly so the background
        # server process is firmly established.
        sandbox.set_timeout(SANDBOX_TIMEOUT_SECONDS)
        print(
            f"Sandbox will stay alive for ~{SANDBOX_TIMEOUT_SECONDS}s "
            "(>5 min) for URL verification."
        )
        print("Done. The sandbox remains running; you can verify the URL now.")
    except Exception:
        # On any failure, don't leave a dangling sandbox silently.
        print("An error occurred; killing the sandbox for cleanup.")
        try:
            sandbox.kill()
        except Exception:
            pass
        raise


def _wait_for_port(sandbox: Sandbox, port: int, timeout: float = 30.0) -> None:
    """Wait until something is listening on `port` inside the sandbox."""
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            res = sandbox.commands.run(
                f"bash -c 'cat < /dev/null > /dev/tcp/127.0.0.1/{port}'",
                timeout=5,
            )
            if res.exit_code == 0:
                return
            last_err = res.stderr
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        time.sleep(0.5)
    raise RuntimeError(
        f"Port {port} did not become ready within {timeout}s. Last error: {last_err}"
    )


def _verify_url_serves(url: str, expected: str, timeout: float = 20.0) -> None:
    """Best-effort check that the public URL serves the expected content."""
    deadline = time.time() + timeout
    last_err = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                body = resp.read().decode("utf-8", errors="replace")
            if expected in body:
                print(f"Verified: public URL serves expected content ({expected!r}).")
                return
            last_err = f"unexpected body: {body!r}"
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
        time.sleep(1.0)
    print(f"Warning: could not verify public URL within {timeout}s ({last_err}).")


if __name__ == "__main__":
    main()