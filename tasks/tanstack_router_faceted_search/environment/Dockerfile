FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier requests pytest-xprocess && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/faceted-search/seed && \
    cat >/home/user/faceted-search/seed/products.json <<'EOF'
[
  {"id": 1, "name": "Aurora Wireless Headphones", "description": "noise cancelling over-ear headphones", "category": "electronics", "price": 199.99, "inStock": true, "rating": 4.6, "createdAt": "2024-01-15"},
  {"id": 2, "name": "Nimbus Bluetooth Speaker", "description": "portable waterproof speaker", "category": "electronics", "price": 59.99, "inStock": false, "rating": 4.2, "createdAt": "2024-03-02"},
  {"id": 3, "name": "Photon 4K Monitor", "description": "27 inch ultra hd monitor", "category": "electronics", "price": 329.00, "inStock": true, "rating": 4.7, "createdAt": "2024-05-20"},
  {"id": 4, "name": "Volt Mechanical Keyboard", "description": "rgb mechanical keyboard", "category": "electronics", "price": 89.99, "inStock": true, "rating": 4.4, "createdAt": "2024-02-10"},
  {"id": 5, "name": "Pixel Webcam Pro", "description": "1080p streaming webcam", "category": "electronics", "price": 45.50, "inStock": false, "rating": 3.9, "createdAt": "2024-06-01"},
  {"id": 6, "name": "The Quantum Garden", "description": "science fiction novel about time", "category": "books", "price": 14.99, "inStock": true, "rating": 4.5, "createdAt": "2023-11-05"},
  {"id": 7, "name": "Cooking with Fire", "description": "grilling and bbq recipes cookbook", "category": "books", "price": 24.99, "inStock": true, "rating": 4.1, "createdAt": "2024-04-18"},
  {"id": 8, "name": "History of the Ancient Sea", "description": "nonfiction maritime history", "category": "books", "price": 19.99, "inStock": false, "rating": 3.8, "createdAt": "2024-01-30"},
  {"id": 9, "name": "Learning TypeScript Deeply", "description": "programming guide for developers", "category": "books", "price": 39.99, "inStock": true, "rating": 4.8, "createdAt": "2024-07-01"},
  {"id": 10, "name": "Trailblazer Rain Jacket", "description": "waterproof hiking jacket", "category": "clothing", "price": 120.00, "inStock": true, "rating": 4.3, "createdAt": "2024-03-15"},
  {"id": 11, "name": "Cloud Runner Sneakers", "description": "lightweight running shoes", "category": "clothing", "price": 89.95, "inStock": false, "rating": 4.0, "createdAt": "2024-02-28"},
  {"id": 12, "name": "Merino Wool Scarf", "description": "soft warm winter scarf", "category": "clothing", "price": 34.99, "inStock": true, "rating": 4.6, "createdAt": "2023-12-10"},
  {"id": 13, "name": "Everyday Cotton Tee", "description": "basic crewneck t-shirt", "category": "clothing", "price": 19.99, "inStock": true, "rating": 3.7, "createdAt": "2024-05-05"},
  {"id": 14, "name": "Lumen Desk Lamp", "description": "adjustable led desk lamp", "category": "home", "price": 42.00, "inStock": true, "rating": 4.2, "createdAt": "2024-04-01"},
  {"id": 15, "name": "Ceramic Pour-Over Set", "description": "coffee brewing dripper", "category": "home", "price": 28.50, "inStock": false, "rating": 4.4, "createdAt": "2024-06-12"},
  {"id": 16, "name": "Cloud Comfort Pillow", "description": "memory foam pillow", "category": "home", "price": 49.99, "inStock": true, "rating": 4.1, "createdAt": "2024-01-22"},
  {"id": 17, "name": "Verdant Planter Trio", "description": "set of three ceramic planters", "category": "home", "price": 36.00, "inStock": true, "rating": 4.5, "createdAt": "2024-07-08"},
  {"id": 18, "name": "Galactic Building Blocks", "description": "500 piece construction set", "category": "toys", "price": 54.99, "inStock": true, "rating": 4.7, "createdAt": "2024-03-20"},
  {"id": 19, "name": "Puzzle Cube Classic", "description": "3x3 speed cube puzzle", "category": "toys", "price": 12.99, "inStock": false, "rating": 4.3, "createdAt": "2024-02-14"},
  {"id": 20, "name": "RC Rally Truck", "description": "remote control offroad truck", "category": "toys", "price": 79.99, "inStock": true, "rating": 4.0, "createdAt": "2024-05-30"}
]
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="TanStack Start + Router faceted search task environment with Node.js v24, a seeded product catalog, and browser verification tooling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for the TanStack Start task environment
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and more
#   - test pip3 packages: requests, pytest-xprocess
#   - /home/user/faceted-search: project directory the agent builds in
#   - /home/user/faceted-search/seed/products.json: seeded 20-product catalog for SQLite import

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
