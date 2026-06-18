FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip xz-utils \
        libfontconfig1 libfreetype6 libxi6 libxrandr2 libxinerama1 libxcursor1 libgl1 libxext6 libx11-6 libpulse0 libasound2t64 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Godot Engine 4.3 (stable) headless-capable Linux binary.
# Picks the build that matches the current container architecture.
RUN cd /tmp && \
    arch="$(uname -m)" && \
    case "$arch" in \
        x86_64|amd64) GODOT_ASSET="Godot_v4.3-stable_linux.x86_64" ;; \
        aarch64|arm64) GODOT_ASSET="Godot_v4.3-stable_linux.arm64" ;; \
        *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac && \
    curl -fsSL -o godot.zip "https://github.com/godotengine/godot/releases/download/4.3-stable/${GODOT_ASSET}.zip" && \
    unzip godot.zip && \
    mv "${GODOT_ASSET}" /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -f godot.zip

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed an empty Godot 4 project at /home/user/dialog_branching_system so the
# executor starts from a clean, valid workspace.
RUN mkdir -p /home/user/dialog_branching_system && \
    cat >/home/user/dialog_branching_system/project.godot <<'EOF'
; Godot 4 project file. Replace as needed.
config_version=5

[application]

config/name="dialog_branching_system"
config/features=PackedStringArray("4.3")
EOF

# Verify godot binary works at build time (best-effort smoke test).
RUN godot --headless --version || true

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment for the dialog_branching_system task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot Engine 4.3 stable Linux binary, symlinked to /usr/local/bin/godot
#   - shared libraries required by the Godot binary even under --headless
#   - /home/user/dialog_branching_system: empty Godot 4 project scaffold for the executor
