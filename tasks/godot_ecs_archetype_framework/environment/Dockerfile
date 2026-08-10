FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GODOT_VERSION=4.3-stable

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip libx11-6 libxext6 libxcursor1 libxinerama1 libxrandr2 libxi6 libxfixes3 \
        libgl1 libglu1-mesa libfontconfig1 libasound2t64 libpulse0 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the headless Godot 4.3 engine binary (offline at runtime; download is build-time only).
RUN cd /tmp && \
    wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_linux.x86_64.zip" && \
    unzip -q "Godot_v${GODOT_VERSION}_linux.x86_64.zip" && \
    mv "Godot_v${GODOT_VERSION}_linux.x86_64" /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -f "Godot_v${GODOT_VERSION}_linux.x86_64.zip"

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold a valid Godot 4.3 project with an empty ecs/world.gd to implement.
RUN mkdir -p /home/user/ecs_project/ecs && \
    cat >/home/user/ecs_project/project.godot <<'EOF'
config_version=5

[application]

config/name="ECS Archetype Framework"
EOF

RUN cat >/home/user/ecs_project/ecs/world.gd <<'EOF'
extends RefCounted

# Implement a minimal archetype-based Entity Component System here.
# See the task description for the exact required public API and semantics.
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Headless Godot 4.3 project scaffold for implementing an archetype-based ECS in GDScript."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot 4.3 headless engine binary installed at /usr/local/bin/godot
#   - shared libraries required by the Godot binary (X11/GL/fontconfig/audio stubs)
#   - /home/user/ecs_project: Godot 4.3 project (project.godot)
#   - /home/user/ecs_project/ecs/world.gd: empty script stub the task must implement

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
