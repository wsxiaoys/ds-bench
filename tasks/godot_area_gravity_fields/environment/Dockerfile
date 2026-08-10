FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip xz-utils \
        libfontconfig1 libfreetype6 libxi6 libxrandr2 libxinerama1 libxcursor1 libgl1 libxext6 libx11-6 libpulse0 libasound2t64 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
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

# Seed a Godot 4 project at /home/user/gravity_fields with the fixed physics
# settings the task relies on (60 Hz ticks, default gravity (0, 100), no damping).
RUN mkdir -p /home/user/gravity_fields && \
    cat >/home/user/gravity_fields/project.godot <<'EOF'
; Godot 4 project file. Physics configuration is fixed for this task.
config_version=5

[application]

config/name="gravity_fields"
config/features=PackedStringArray("4.3")

[physics]

common/physics_ticks_per_second=60
2d/default_gravity=100.0
2d/default_gravity_vector=Vector2(0, 1)
2d/default_linear_damp=0.0
2d/default_angular_damp=0.0
EOF

# Verify godot binary works at build time (best-effort smoke test).
RUN godot --headless --version || true

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment for the godot_area_gravity_fields task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - Godot Engine 4.3 stable Linux binary, symlinked to /usr/local/bin/godot
#   - shared libraries required by the Godot binary even under --headless
#   - /home/user/gravity_fields: seeded Godot 4 project with fixed physics settings

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
