import os
import time
import subprocess
import pytest
import urllib.request
import urllib.error

PROJECT_DIR = "/home/user/app"

@pytest.fixture(scope="module")
def next_server():
    # Install playwright locally for the test
    subprocess.run(["npm", "install", "playwright"], cwd=PROJECT_DIR, check=True)
    subprocess.run(["npx", "playwright", "install", "chromium"], cwd=PROJECT_DIR, check=True)

    # Build the app
    subprocess.run(["npm", "run", "build"], cwd=PROJECT_DIR, check=True)
    
    # Start the app
    process = subprocess.Popen(
        ["npm", "start"],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    
    # Wait for the server to be ready
    start_time = time.time()
    server_ready = False
    while time.time() - start_time < 30:
        try:
            urllib.request.urlopen("http://localhost:3000")
            server_ready = True
            break
        except urllib.error.URLError:
            pass
        time.sleep(0.5)
        
    if not server_ready:
        process.terminate()
        pytest.fail("Next.js server failed to start within 30 seconds")
        
    yield process
    
    process.terminate()
    process.wait()

def test_stream_output(next_server):
    script = """
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('#stream-output', { timeout: 10000 });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#stream-output');
        return el && el.textContent.includes('1, 2, 3');
      },
      { timeout: 10000 }
    );
    console.log("SUCCESS");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
"""
    script_path = os.path.join(PROJECT_DIR, "verify_browser.js")
    with open(script_path, "w") as f:
        f.write(script)
        
    result = subprocess.run(
        ["node", script_path],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True
    )
    
    assert "SUCCESS" in result.stdout, f"Browser verification failed. Output: {result.stdout}\nError: {result.stderr}"
