FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip xz-utils \
        libfontconfig1 libfreetype6 libx11-6 libxcursor1 libxinerama1 libxrandr2 \
        libxi6 libgl1 libasound2t64 libpulse0 libdbus-1-3 libstdc++6 && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Godot Engine 4.3 (stable) headless-capable binary.
# The standard Linux build supports the `--headless` flag, so a separate
# headless distribution is not required.
RUN ARCH="$(uname -m)" && \
    if [ "$ARCH" = "x86_64" ]; then GODOT_ARCH="linux.x86_64"; \
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then GODOT_ARCH="linux.arm64"; \
    else echo "Unsupported architecture: $ARCH" >&2; exit 1; fi && \
    cd /tmp && \
    curl -fsSL -o /tmp/godot.zip \
        "https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_${GODOT_ARCH}.zip" && \
    unzip -q /tmp/godot.zip -d /tmp/godot && \
    mv "/tmp/godot/Godot_v4.3-stable_${GODOT_ARCH}" /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -rf /tmp/godot /tmp/godot.zip

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment for a deterministic procedural dungeon generator task built with TileMapLayer + FastNoiseLite."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot 4.3-stable binary installed at /usr/local/bin/godot (supports --headless)
#   - Supporting libraries needed by the Godot binary even in --headless mode
#   - /home/user/myproject: empty project directory; the executor populates it
