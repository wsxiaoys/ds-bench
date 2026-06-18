FROM ubuntu:24.04

# Base apt packages + build toolchain for godot-cpp + Godot 4.3 headless-capable binary.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip xz-utils pkg-config build-essential g++ make scons && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Godot 4.3 stable Linux x86_64 binary; this binary supports `--headless`.
RUN mkdir -p /opt/godot && \
    cd /opt/godot && \
    curl -fSL -o godot.zip \
        https://github.com/godotengine/godot-builds/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip && \
    unzip -q godot.zip && \
    rm godot.zip && \
    mv Godot_v4.3-stable_linux.x86_64 /opt/godot/godot && \
    chmod +x /opt/godot/godot && \
    ln -sf /opt/godot/godot /usr/local/bin/godot

# Prepare the user directory.
RUN mkdir -p /home/user && chmod 0755 /home/user

# Bootstrap the project directory:
#   - /home/user/myproject/project.godot   (minimal Godot 4 project)
#   - /home/user/myproject/godot-cpp/      (REAL godot-cpp checkout, 4.3 branch from official upstream)
# NOTE: We do NOT stub or mock godot-cpp; we clone the official repository at the 4.3 branch.
RUN mkdir -p /home/user/myproject && \
    cat >/home/user/myproject/project.godot <<'EOF'
; Engine configuration file for the FastVectorMath GDExtension task.

config_version=5

[application]

config/name="FastVectorMath"
config/features=PackedStringArray("4.3")

[debug]

settings/stdout/print_fps=false
EOF

RUN cd /home/user/myproject && \
    git clone --depth 1 --branch 4.3 https://github.com/godotengine/godot-cpp.git godot-cpp && \
    rm -rf /home/user/myproject/godot-cpp/.git

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot 4.3 headless + scons/g++ toolchain + official godot-cpp 4.3 source for a GDExtension C++ task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - C++ build toolchain: build-essential g++ make scons pkg-config unzip xz-utils
#   - Godot 4.3-stable Linux x86_64 binary at /opt/godot/godot, available as `godot` in PATH (supports --headless)
#   - /home/user/myproject/project.godot: minimal Godot 4.3 project bootstrap
#   - /home/user/myproject/godot-cpp/: official godot-cpp 4.3 sources (cloned from github.com/godotengine/godot-cpp)
