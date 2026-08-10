FROM ubuntu:24.04

ARG POCHI_VERSION
ARG TARGETARCH
ARG GODOT_VERSION=4.3-stable

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep unzip \
        libx11-6 libxcursor1 libxinerama1 libxrandr2 libxi6 libxkbcommon0 \
        libgl1 libglu1-mesa libfontconfig1 libasound2t64 libpulse0 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Godot 4.3-stable (headless-capable standard build), arch-aware.
RUN case "${TARGETARCH}" in \
        amd64) GARCH="linux.x86_64" ;; \
        arm64) GARCH="linux.arm64" ;; \
        *) echo "Unsupported TARGETARCH=${TARGETARCH}" && exit 1 ;; \
    esac && \
    wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_${GARCH}.zip" -O /tmp/godot.zip && \
    unzip -q /tmp/godot.zip -d /tmp/godot && \
    mv "/tmp/godot/Godot_v${GODOT_VERSION}_${GARCH}" /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -rf /tmp/godot.zip /tmp/godot

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a minimal, importable Godot 4.3 project. The solver implements the
# scheduler at scheduler/frame_scheduler.gd.
RUN mkdir -p /home/user/godot_coroutine_scheduler/scheduler && \
    cat >/home/user/godot_coroutine_scheduler/project.godot <<'EOF'
; Engine configuration file.
; Godot 4.3 project for the frame-based coroutine scheduler task.

config_version=5

[application]

config/name="godot_coroutine_scheduler"
config/features=PackedStringArray("4.3")
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot 4.3-stable headless environment with a scaffolded GDScript project for building a deterministic frame-based coroutine scheduler."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - extra apt packages: unzip + runtime shared libs required by the Godot binary
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot 4.3-stable installed at /usr/local/bin/godot (arch-aware: x86_64 / arm64), runnable with --headless
#   - /home/user/godot_coroutine_scheduler: scaffolded Godot 4.3 project (project.godot + empty scheduler/ dir)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
