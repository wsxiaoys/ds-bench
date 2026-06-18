FROM ubuntu:24.04

ENV GODOT_VERSION=4.3-stable

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep unzip \
        libfontconfig1 libfreetype6 libx11-6 libxcursor1 libxi6 libxinerama1 libxrandr2 \
        libgl1 libasound2t64 libpulse0 libdbus-1-3 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fsSL -o /tmp/godot.zip \
        "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_linux.x86_64.zip" && \
    unzip -j /tmp/godot.zip -d /tmp/godot && \
    mv "/tmp/godot/Godot_v${GODOT_VERSION}_linux.x86_64" /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -rf /tmp/godot /tmp/godot.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Initial Godot project skeleton at /home/user/myproject.
# The executor is expected to add scripts/, scenes/, and resources/ contents.
RUN mkdir -p /home/user/myproject && \
    cat > /home/user/myproject/project.godot <<'EOF'
; Engine configuration file for the Enemy Stats Spawner task.
config_version=5

[application]

config/name="EnemyStatsSpawner"
config/features=PackedStringArray("4.3", "Forward Plus")

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment with an empty project skeleton at /home/user/myproject for the enemy_stats_resource_spawner task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - extra apt packages: unzip and Godot runtime deps (X11, font, GL, audio shared libs)
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot Engine 4.3-stable binary installed as /usr/local/bin/godot
#   - /home/user/myproject: Godot project skeleton with project.godot only
