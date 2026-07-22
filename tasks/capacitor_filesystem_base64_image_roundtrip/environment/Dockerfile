FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf requests pytest-xprocess playwright && \
    python3 -m playwright install chromium && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/capacitor-fs-roundtrip/src /home/user/capacitor-fs-roundtrip/public

RUN cat >/home/user/capacitor-fs-roundtrip/package.json <<'EOF'
{
  "name": "capacitor-fs-roundtrip",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@capacitor/core": "^8.0.0",
    "@capacitor/filesystem": "^8.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0"
  }
}
EOF

RUN cat >/home/user/capacitor-fs-roundtrip/vite.config.ts <<'EOF'
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 4173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
});
EOF

RUN cat >/home/user/capacitor-fs-roundtrip/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": []
  },
  "include": ["src"]
}
EOF

RUN cat >/home/user/capacitor-fs-roundtrip/index.html <<'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Capacitor Filesystem Base64 Image Round-Trip</title>
  </head>
  <body>
    <h1>Capacitor Filesystem Base64 Image Round-Trip</h1>
    <dl>
      <dt>Status</dt>
      <dd id="status"></dd>
      <dt>Original hash</dt>
      <dd id="original-hash"></dd>
      <dt>Read-back hash</dt>
      <dd id="readback-hash"></dd>
      <dt>Match</dt>
      <dd id="match"></dd>
      <dt>Byte length</dt>
      <dd id="byte-length"></dd>
      <dt>Write URI</dt>
      <dd id="write-uri"></dd>
      <dt>Directory listing</dt>
      <dd id="dir-listing"></dd>
    </dl>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

RUN cat >/home/user/capacitor-fs-roundtrip/src/main.ts <<'EOF'
// TODO: Implement the Capacitor Filesystem base64 image round-trip here.
//
// On page load you must:
//   1. Load the binary image served at "/sample.png" and base64-encode its bytes.
//   2. Write it as BINARY into Directory.Data at "images/roundtrip/sample.png",
//      creating the missing parent directories.
//   3. Read it back as BINARY, decode it, and hash both sides with SHA-256.
//   4. Render the results into the existing DOM elements (see index.html):
//      #status, #original-hash, #readback-hash, #match, #byte-length,
//      #write-uri, #dir-listing.
//
// The @capacitor/filesystem web implementation (IndexedDB) is used automatically
// in the browser; no native runtime is required.
export {};
EOF

RUN python3 - <<'EOF'
import zlib, struct

width, height = 24, 24
raw = bytearray()
for y in range(height):
    raw.append(0)  # filter type 0 for each scanline
    for x in range(width):
        raw += bytes([(x * 11) % 256, (y * 7) % 256, (x * y) % 256])

def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )

png = b"\x89PNG\r\n\x1a\n"
png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
png += chunk(b"IEND", b"")

with open("/home/user/capacitor-fs-roundtrip/public/sample.png", "wb") as f:
    f.write(png)
EOF

RUN cd /home/user/capacitor-fs-roundtrip && npm install

LABEL Author="generate-harbor-tasks"
LABEL Description="Capacitor v8 Filesystem web (IndexedDB) base64 image round-trip task: Vite + TypeScript project scaffold with a bundled PNG asset, plus Playwright headless Chromium for verification."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 for the Vite + Capacitor web project
#   - browser verification: Playwright with headless Chromium (+ required system libraries)
#   - pip3 packages for tests: requests, pytest-xprocess, playwright
#   - /home/user/capacitor-fs-roundtrip: pre-scaffolded Vite + TypeScript project
#       * package.json with @capacitor/core and @capacitor/filesystem (installed into node_modules)
#       * index.html with the required result elements (ids)
#       * src/main.ts stub for the agent to implement
#       * public/sample.png: bundled binary PNG asset served at /sample.png

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
