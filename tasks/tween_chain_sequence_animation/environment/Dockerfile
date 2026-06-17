FROM ubuntu:24.04

ARG GODOT_VERSION=4.3-stable
ARG GODOT_ZIP=Godot_v4.3-stable_linux.x86_64.zip
ARG GODOT_BIN=Godot_v4.3-stable_linux.x86_64

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip xz-utils libfontconfig1 libfreetype6 libgl1 libxcursor1 libxinerama1 \
        libxi6 libxrandr2 libxext6 libx11-6 libasound2t64 libpulse0 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fsSL -o /tmp/godot.zip \
        "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/${GODOT_ZIP}" && \
    unzip -q /tmp/godot.zip -d /opt/godot && \
    rm /tmp/godot.zip && \
    chmod +x "/opt/godot/${GODOT_BIN}" && \
    ln -s "/opt/godot/${GODOT_BIN}" /usr/local/bin/godot && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the initial Godot project layout that the executor will fill in.
RUN mkdir -p /home/user/godot_project/scenes \
             /home/user/godot_project/scripts \
             /home/user/godot_project/tests && \
    cat >/home/user/godot_project/project.godot <<'EOF'
; Godot project configuration for the tween_chain_sequence_animation task.
config_version=5

[application]

config/name="tween_chain_sequence_animation"
config/features=PackedStringArray("4.3")

[rendering]

renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
EOF

# Pre-import the project so subsequent godot calls find resources cleanly.
RUN cd /home/user/godot_project && \
    (godot --headless --import || true)

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot Engine 4.3 headless environment for the tween_chain_sequence_animation task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep unzip xz-utils
#                   libfontconfig1 libfreetype6 libgl1 libxcursor1 libxinerama1 libxi6 libxrandr2 libxext6 libx11-6
#                   libasound2t64 libpulse0
#   - pip3 packages: pytest-json-ctrf
#   - Godot Engine 4.3-stable Linux x86_64 binary at /opt/godot/Godot_v4.3-stable_linux.x86_64
#   - /usr/local/bin/godot symlink to the Godot binary
#   - /home/user/godot_project: empty Godot project skeleton with project.godot
