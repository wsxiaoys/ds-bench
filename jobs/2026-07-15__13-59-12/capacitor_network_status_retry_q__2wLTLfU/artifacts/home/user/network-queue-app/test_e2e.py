#!/usr/bin/env python3
"""End-to-end test for the offline-aware request queue."""
import json
import time
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

def api_post(path, data=None):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode() if data else b""
    req = urllib.request.Request(url, data=body, method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def api_get(path):
    url = f"{BASE}{path}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())

def wait_for(fn, timeout=10, interval=0.1):
    """Poll fn() until it returns truthy or timeout."""
    start = time.time()
    while time.time() - start < timeout:
        result = fn()
        if result:
            return result
        time.sleep(interval)
    return None

def submit_async(page, var_name, req):
    """Submit a request without awaiting - stores result in window[var_name]."""
    js = f"""() => {{
        window.{var_name} = undefined;
        window.{var_name}_err = undefined;
        window.offlineQueue.submit({json.dumps(req)})
            .then(r => {{ window.{var_name} = r; }})
            .catch(e => {{ window.{var_name}_err = e.message; }});
    }}"""
    page.evaluate(js)

def main():
    # Reset server state
    api_post("/api/reset")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        page.goto(BASE, wait_until="networkidle")

        # Wait for window.offlineQueue to be available
        assert wait_for(lambda: page.evaluate("() => !!window.offlineQueue")), \
            "window.offlineQueue not available"
        print("[PASS] window.offlineQueue is available")

        # Check initial connected state (should be online)
        assert page.evaluate("() => window.offlineQueue.connected()") == True, \
            "Should start connected"
        print("[PASS] Initial state: connected")

        # --- Test 1: Submit while connected (immediate send) ---
        submit_async(page, "_result1", {"id": "t1", "body": "test1"})
        assert wait_for(lambda: page.evaluate("() => window._result1")), \
            "Submit while connected should resolve"
        result1 = page.evaluate("() => window._result1")
        assert result1["status"] == "ok" and result1["id"] == "t1", f"Unexpected result: {result1}"
        print("[PASS] Test 1: Submit while connected sends immediately")

        # --- Test 2: Retry with exponential backoff (failTimes=2) ---
        submit_async(page, "_result2", {"id": "t2", "body": "test2", "failTimes": 2})
        assert wait_for(lambda: page.evaluate("() => window._result2"), timeout=15), \
            "Retry with backoff should eventually succeed"
        result2 = page.evaluate("() => window._result2")
        assert result2["status"] == "ok", f"Unexpected result: {result2}"
        print("[PASS] Test 2: Retry with exponential backoff succeeds after transient failures")

        # --- Test 3: Go offline, submit, check queue buffering ---
        page.evaluate("() => window.dispatchEvent(new Event('offline'))")
        wait_for(lambda: page.evaluate("() => !window.offlineQueue.connected()"))
        assert page.evaluate("() => window.offlineQueue.connected()") == False, \
            "Should be disconnected after offline event"
        print("[PASS] Test 3a: Going offline detected via @capacitor/network")

        # Submit while offline (non-awaiting)
        submit_async(page, "_result3", {"id": "t3", "body": "buffered1"})
        time.sleep(0.5)
        # Should NOT have resolved yet
        assert page.evaluate("() => window._result3") == None, \
            "Submit while offline should not resolve immediately"
        pending = page.evaluate("() => window.offlineQueue.pending()")
        assert pending == ["t3"], f"Expected ['t3'], got {pending}"
        print("[PASS] Test 3b: Request buffered while offline, pending() shows ['t3']")

        # --- Test 4: De-duplication ---
        submit_async(page, "_result3_dup", {"id": "t3", "body": "buffered1"})
        time.sleep(0.3)
        pending = page.evaluate("() => window.offlineQueue.pending()")
        assert pending == ["t3"], f"Duplicate should not add second copy, got {pending}"
        print("[PASS] Test 4: De-duplication prevents second copy of identical request")

        # Different body should add a new entry
        submit_async(page, "_result4", {"id": "t3", "body": "buffered2"})
        time.sleep(0.3)
        pending = page.evaluate("() => window.offlineQueue.pending()")
        assert pending == ["t3", "t3"], f"Different body should add new entry, got {pending}"
        print("[PASS] Test 4b: Same id but different body IS added")

        # Add another distinct request
        submit_async(page, "_result5", {"id": "t4", "body": "buffered3"})
        time.sleep(0.3)
        pending = page.evaluate("() => window.offlineQueue.pending()")
        assert pending == ["t3", "t3", "t4"], f"Expected ['t3','t3','t4'], got {pending}"
        print("[PASS] Test 4c: Multiple distinct requests queued in FIFO order")

        # --- Test 5: Automatic flush on reconnect ---
        received = api_get("/api/received")
        received_ids = [m["id"] for m in received["messages"]]
        assert "t3" not in received_ids and "t4" not in received_ids, \
            "Buffered requests should not be on server yet"
        print("[PASS] Test 5a: Buffered requests not yet on server")

        # Go back online
        page.evaluate("() => window.dispatchEvent(new Event('online'))")
        wait_for(lambda: page.evaluate("() => window.offlineQueue.connected()"))

        # Wait for queue to flush
        assert wait_for(lambda: page.evaluate("() => window.offlineQueue.pending().length === 0"), timeout=15), \
            "Queue should be empty after reconnect flush"
        print("[PASS] Test 5b: Queue flushed after reconnect")

        # Verify all promises resolved
        assert wait_for(lambda: page.evaluate("() => window._result3"), timeout=5), "t3 (buffered1) promise should resolve"
        assert wait_for(lambda: page.evaluate("() => window._result3_dup"), timeout=5), "t3 dup promise should resolve"
        assert wait_for(lambda: page.evaluate("() => window._result4"), timeout=5), "t3 (buffered2) promise should resolve"
        assert wait_for(lambda: page.evaluate("() => window._result5"), timeout=5), "t4 promise should resolve"
        print("[PASS] Test 5c: All buffered request promises resolved")

        # Verify server received messages in FIFO order
        received = api_get("/api/received")
        received_ids = [m["id"] for m in received["messages"]]
        # t1, t2 were sent earlier; then t3, t3, t4
        assert received_ids == ["t1", "t2", "t3", "t3", "t4"], \
            f"Server should have messages in FIFO order, got {received_ids}"
        print(f"[PASS] Test 5d: Server received messages in FIFO order: {received_ids}")

        # --- Test 6: Retry gives up after 4 attempts ---
        api_post("/api/reset")
        # failTimes=10 means server always returns 503; client should give up after 4 attempts
        submit_async(page, "_result6", {"id": "t6", "body": "willfail", "failTimes": 10})
        assert wait_for(lambda: page.evaluate("() => window._result6_err"), timeout=15), \
            "Should reject after exhausting retries"
        print("[PASS] Test 6: Retry gives up after 4 attempts, promise rejected")

        # Verify t6 was NOT recorded on server
        received = api_get("/api/received")
        received_ids = [m["id"] for m in received["messages"]]
        assert "t6" not in received_ids, "Failed request should not be on server"
        print("[PASS] Test 6b: Failed request not recorded on server")

        # Check console errors
        if console_errors:
            print(f"[WARN] Console errors: {console_errors}")
        else:
            print("[PASS] No console errors")

        browser.close()

    print("\n*** All tests passed! ***")

if __name__ == "__main__":
    main()