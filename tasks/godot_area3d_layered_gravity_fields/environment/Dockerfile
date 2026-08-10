FROM ubuntu:24.04

ARG POCHI_VERSION
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
    DPKG_ARCH="$(dpkg --print-architecture)" && \
    case "$DPKG_ARCH" in \
        amd64) GODOT_ARCH="x86_64" ;; \
        arm64) GODOT_ARCH="arm64" ;; \
        *) echo "Unsupported architecture: $DPKG_ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL -o /tmp/godot.zip "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_linux.${GODOT_ARCH}.zip" && \
    unzip -o /tmp/godot.zip -d /tmp/godot && \
    mv "/tmp/godot/Godot_v${GODOT_VERSION}_linux.${GODOT_ARCH}" /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -rf /tmp/godot /tmp/godot.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Godot needs a writable, isolated home for its editor/runtime data (config,
# import caches) so that headless runs work non-interactively as root.
ENV HOME=/root
ENV XDG_DATA_HOME=/root/.local/share
ENV XDG_CONFIG_HOME=/root/.config
ENV XDG_CACHE_HOME=/root/.cache

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment for the area3d_layered_gravity_fields physics task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot Engine 4.3 (stable) headless-capable binary installed at /usr/local/bin/godot
#   - runtime shared libs required by the Godot binary (X11/GL/font/audio stubs) for headless startup
#   - /home/user: working directory where the solver creates the gravity_sim Godot project

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
