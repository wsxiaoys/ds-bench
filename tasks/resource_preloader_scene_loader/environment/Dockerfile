FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip libfontconfig1 libxcursor1 libxinerama1 libxi6 libxrandr2 libxrender1 \
        libgl1 libglu1-mesa libxext6 libx11-6 libasound2t64 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Godot 4.3 stable (standard linux binary; supports --headless).
RUN curl -fsSL -o /tmp/godot.zip \
        https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip && \
    unzip /tmp/godot.zip -d /opt/godot && \
    mv /opt/godot/Godot_v4.3-stable_linux.x86_64 /opt/godot/godot && \
    chmod +x /opt/godot/godot && \
    ln -s /opt/godot/godot /usr/local/bin/godot && \
    rm -f /tmp/godot.zip

RUN mkdir -p /home/user && chmod 0755 /home/user

# Seed an empty Godot 4 project skeleton so the executor knows where to work.
RUN mkdir -p /home/user/myproject && \
    cat >/home/user/myproject/project.godot <<'EOF'
; Engine configuration file.
;
; It's best edited using the editor UI and not directly,
; since the parameters that go here are not all obvious.
;
; Format:
;   [section] ; section goes between []
;   param=value ; assign values to parameters

config_version=5

[application]

config/name="ResourcePreloaderSceneLoader"
config/features=PackedStringArray("4.3")
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment for the resource_preloader_scene_loader task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot Engine 4.3-stable Linux binary at /usr/local/bin/godot (supports --headless)
#   - /home/user/myproject: starter Godot 4 project directory with a minimal project.godot
