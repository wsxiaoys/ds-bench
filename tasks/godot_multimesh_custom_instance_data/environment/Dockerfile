FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GODOT_VERSION=4.3-stable

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip \
        libx11-6 libxcursor1 libxinerama1 libxi6 libxrandr2 libxext6 libxrender1 \
        libgl1 libglu1-mesa libfontconfig1 libfreetype6 libasound2t64 libpulse0 \
        libudev1 libglib2.0-0 libdbus-1-3 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fL -o /tmp/godot.zip \
        https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_linux.x86_64.zip && \
    unzip -o /tmp/godot.zip -d /tmp/godot && \
    mv /tmp/godot/Godot_v${GODOT_VERSION}_linux.x86_64 /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -rf /tmp/godot /tmp/godot.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed a minimal, empty Godot 4.x project. The agent adds the class script and
# produces the build artifacts.
RUN mkdir -p /home/user/instancing_project && \
    cat >/home/user/instancing_project/project.godot <<'EOF'
; Engine configuration file.
config_version=5

[application]

config/name="Instancing Project"
config/features=PackedStringArray("4.3")
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment with an empty project at /home/user/instancing_project for MultiMesh instance-data authoring and CPU-side culling."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot Engine 4.3-stable (headless-capable) installed as /usr/local/bin/godot
#   - shared libraries required to load the Godot binary in a display-less container
#   - /home/user/instancing_project: empty Godot 4.x project (project.godot only)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
