#!/usr/bin/env python3
"""Test the toast queue manager behavior in a headless browser."""

import time
import re
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4173"
PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"

results = []

def check(name, cond, detail=""):
    status = PASS if cond else FAIL
    results.append(cond)
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))

def get_toasts(page):
    """Return list of pwa-toast elements as dicts with text, data-position."""
    return page.evaluate("""() => {
        const els = [...document.querySelectorAll('pwa-toast')];
        return els.map(e => ({
            text: e.text,
            message: e.message,
            dataPosition: e.getAttribute('data-position'),
            duration: e.duration,
        }));
    }""")

def count_toasts(page):
    return page.evaluate("() => document.querySelectorAll('pwa-toast').length")

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(BASE_URL, wait_until="networkidle")

        # Verify window API exists
        print("\n=== Test 1: Window API exists ===")
        check("window.enqueueToast exists",
              page.evaluate("typeof window.enqueueToast === 'function'"))
        check("window.drainToastQueue exists",
              page.evaluate("typeof window.drainToastQueue === 'function'"))
        check("window.getQueueState exists",
              page.evaluate("typeof window.getQueueState === 'function'"))

        # Verify initial state
        print("\n=== Test 2: Initial queue state ===")
        state = page.evaluate("() => window.getQueueState()")
        check("pending == 0", state["pending"] == 0, f"got {state}")
        check("active == false", state["active"] == False, f"got {state}")

        # Test single toast
        print("\n=== Test 3: Single toast ===")
        page.evaluate("""async () => {
            await window.enqueueToast({ text: 'Hello Test', duration: 500, position: 'top' });
        }""")
        check("No toast elements after completion", count_toasts(page) == 0)
        state = page.evaluate("() => window.getQueueState()")
        check("Queue empty after single toast",
              state["pending"] == 0 and state["active"] == False, f"got {state}")

        # Test toast element properties while active
        print("\n=== Test 4: Toast element properties ===")
        page.evaluate("""async () => {
            window._toastDone = false;
            window.enqueueToast({ text: 'Property Test', duration: 800, position: 'center' }).then(() => {
                window._toastDone = true;
            });
        }""")
        time.sleep(0.3)
        toasts = get_toasts(page)
        check("Exactly one toast element", len(toasts) == 1, f"got {len(toasts)}")
        if len(toasts) == 1:
            t = toasts[0]
            check("text property == 'Property Test'",
                  t["text"] == "Property Test", f"got '{t['text']}'")
            check("data-position == 'center'",
                  t["dataPosition"] == "center", f"got '{t['dataPosition']}'")
            check("message property == 'Property Test' (set by plugin)",
                  t["message"] == "Property Test", f"got '{t['message']}'")
        check("Only one toast element at a time", count_toasts(page) == 1)
        # Wait for it to finish
        page.evaluate("""async () => {
            while (!window._toastDone) {
                await new Promise(r => setTimeout(r, 50));
            }
        }""")
        check("Element removed after duration", count_toasts(page) == 0)

        # Test FIFO ordering with burst
        print("\n=== Test 5: FIFO ordering with burst ===")
        page.evaluate("""async () => {
            window._burstResults = [];
            for (let i = 1; i <= 5; i++) {
                const text = `Burst ${i}`;
                window.enqueueToast({ text, duration: 300 }).then(() => {
                    window._burstResults.push(text);
                });
            }
        }""")
        time.sleep(0.2)

        observed_texts = []
        for i in range(20):
            toasts = get_toasts(page)
            if len(toasts) == 1:
                observed_texts.append(toasts[0]["text"])
            time.sleep(0.25)

        # Check we saw all 5 toasts in order
        unique_observed = []
        for t in observed_texts:
            if t not in unique_observed:
                unique_observed.append(t)

        check("Saw 5 unique toasts", len(unique_observed) == 5,
              f"saw {unique_observed}")
        check("Toasts appeared in FIFO order",
              unique_observed == [f"Burst {i}" for i in range(1, 6)],
              f"got {unique_observed}")

        # Check no overlap at any point
        max_concurrent = 0
        # Reset and test max concurrent more carefully
        page.evaluate("""async () => {
            window._burstDone = false;
            window._maxConcurrent = 0;
            window._interval = setInterval(() => {
                const c = document.querySelectorAll('pwa-toast').length;
                if (c > window._maxConcurrent) window._maxConcurrent = c;
            }, 10);
            const promises = [];
            for (let i = 1; i <= 8; i++) {
                promises.push(window.enqueueToast({ text: `Overlap ${i}`, duration: 250 }));
            }
            await Promise.all(promises);
            clearInterval(window._interval);
            window._burstDone = true;
        }""")
        page.evaluate("""async () => {
            while (!window._burstDone) {
                await new Promise(r => setTimeout(r, 50));
            }
        }""")

        max_concurrent = page.evaluate("() => window._maxConcurrent")
        check("Never more than 1 concurrent toast",
              max_concurrent <= 1, f"max was {max_concurrent}")

        # Test drainToastQueue
        print("\n=== Test 6: drainToastQueue ===")
        # Enqueue some toasts
        page.evaluate("""async () => {
            for (let i = 1; i <= 3; i++) {
                window.enqueueToast({ text: `Drain ${i}`, duration: 300 });
            }
        }""")
        state = page.evaluate("() => window.getQueueState()")
        check("Queue has pending toasts", state["pending"] >= 1, f"got {state}")

        drain_start = time.time()
        page.evaluate("""async () => {
            await window.drainToastQueue();
            window._drainDone = true;
        }""")
        page.evaluate("""async () => {
            while (!window._drainDone) {
                await new Promise(r => setTimeout(r, 50));
            }
        }""")
        drain_duration = time.time() - drain_start
        check("drainToastQueue resolved", True)
        state = page.evaluate("() => window.getQueueState()")
        check("Queue empty after drain",
              state["pending"] == 0 and state["active"] == False, f"got {state}")
        check("All elements removed after drain", count_toasts(page) == 0)

        # Test drainToastQueue when already idle
        print("\n=== Test 7: drainToastQueue when idle ===")
        page.evaluate("""async () => {
            window._idleDrainTime = 0;
            const start = performance.now();
            await window.drainToastQueue();
            window._idleDrainTime = performance.now() - start;
        }""")
        idle_time = page.evaluate("() => window._idleDrainTime")
        check("drainToastQueue resolves immediately when idle",
              idle_time < 50, f"took {idle_time:.1f}ms")

        # Test enqueueToast promise resolves only after element removed
        print("\n=== Test 8: enqueueToast promise timing ===")
        page.evaluate("""async () => {
            window._promiseTest = {};
            const start = performance.now();
            window.enqueueToast({ text: 'Promise Timing', duration: 600 }).then(() => {
                window._promiseTest.duration = performance.now() - start;
                window._promiseTest.elementCount = document.querySelectorAll('pwa-toast').length;
            });
        }""")
        time.sleep(0.3)
        check("Element exists during display", count_toasts(page) == 1)
        page.evaluate("""async () => {
            while (!window._promiseTest.duration) {
                await new Promise(r => setTimeout(r, 50));
            }
        }""")
        pt = page.evaluate("() => window._promiseTest")
        check("Promise resolved after ~600ms", 500 < pt["duration"] < 900,
              f"took {pt['duration']:.0f}ms")
        check("Element removed when promise resolves", pt["elementCount"] == 0,
              f"got {pt['elementCount']}")

        # Test duration: 'short' and 'long'
        print("\n=== Test 9: Duration strings ===")
        page.evaluate("""async () => {
            window._shortDuration = 0;
            const start = performance.now();
            await window.enqueueToast({ text: 'Short', duration: 'short' });
            window._shortDuration = performance.now() - start;
        }""")
        short_dur = page.evaluate("() => window._shortDuration")
        check("'short' maps to ~2000ms", 1800 < short_dur < 2400,
              f"took {short_dur:.0f}ms")

        page.evaluate("""async () => {
            window._longDuration = 0;
            const start = performance.now();
            await window.enqueueToast({ text: 'Long', duration: 'long' });
            window._longDuration = performance.now() - start;
        }""")
        long_dur = page.evaluate("() => window._longDuration")
        check("'long' maps to ~3500ms", 3300 < long_dur < 4000,
              f"took {long_dur:.0f}ms")

        # Test default duration (omitted)
        print("\n=== Test 10: Default duration ===")
        page.evaluate("""async () => {
            window._defaultDuration = 0;
            const start = performance.now();
            await window.enqueueToast({ text: 'Default' });
            window._defaultDuration = performance.now() - start;
        }""")
        default_dur = page.evaluate("() => window._defaultDuration")
        check("Default duration ~2000ms", 1800 < default_dur < 2400,
              f"took {default_dur:.0f}ms")

        # Test default position
        print("\n=== Test 11: Default position ===")
        page.evaluate("""async () => {
            window._defaultPos = null;
            window.enqueueToast({ text: 'Default Pos', duration: 500 }).then(() => {});
        }""")
        time.sleep(0.2)
        toasts = get_toasts(page)
        if len(toasts) == 1:
            check("Default position == 'bottom'",
                  toasts[0]["dataPosition"] == "bottom",
                  f"got '{toasts[0]['dataPosition']}'")
        else:
            check("Default position == 'bottom'", False, f"got {len(toasts)} toasts")
        page.evaluate("""async () => {
            await window.drainToastQueue();
        }""")

        browser.close()

    print(f"\n{'='*50}")
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} passed")
    if passed == total:
        print(f"\n[{PASS}] ALL TESTS PASSED")
    else:
        print(f"\n[{FAIL}] SOME TESTS FAILED")
    return 0 if passed == total else 1

if __name__ == "__main__":
    import sys
    sys.exit(main())