FROM --platform=linux/amd64 ubuntu:24.04

# ---------------------------------------------------------------------------
# System packages, Python tooling, and graphics stack for headless rendering.
# ---------------------------------------------------------------------------
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip xz-utils \
        xvfb xauth \
        libfontconfig1 libfreetype6 libxcursor1 libxinerama1 libxi6 libxrandr2 libxrender1 \
        libxext6 libx11-6 libxcb1 libxkbcommon0 libxss1 libasound2t64 \
        libgl1 libglx-mesa0 libegl1 libglu1-mesa libgl1-mesa-dri \
        mesa-vulkan-drivers libvulkan1 vulkan-tools && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Install Godot 4.3 stable (Linux x86_64) from the official GitHub release.
# We use the standard Linux build which supports `--headless` execution and
# also runs under Xvfb when full software rendering is needed.
# ---------------------------------------------------------------------------
RUN mkdir -p /opt/godot && \
    cd /tmp && \
    curl -fsSL -o godot.zip \
        https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip && \
    unzip -q godot.zip -d /opt/godot && \
    mv /opt/godot/Godot_v4.3-stable_linux.x86_64 /opt/godot/godot && \
    chmod +x /opt/godot/godot && \
    ln -s /opt/godot/godot /usr/local/bin/godot && \
    rm -f /tmp/godot.zip && \
    /opt/godot/godot --headless --version

# ---------------------------------------------------------------------------
# Scaffold the user's Godot project directory. The agent must populate it with
# scenes and scripts; we only provide a minimal project.godot stub so the
# project is recognised as a Godot 4 project from the start.
# ---------------------------------------------------------------------------
RUN mkdir -p /home/user && chmod 0755 /home/user && \
    mkdir -p /home/user/myproject && \
    cat > /home/user/myproject/project.godot <<'EOF'
; Engine configuration file.
; Generated as initial scaffold for the viewport_render_target_camera task.

config_version=5

[application]

config/name="Render Target Camera"
config/features=PackedStringArray("4.3", "Forward Plus")

[rendering]

renderer/rendering_method="forward_plus"
EOF

# Default rendering driver hint (Godot honours this at startup when paired
# with `--headless`).
ENV GODOT_RENDERING_DRIVER=opengl3
# Force Vulkan / GL to fall back to software-only Mesa drivers in the
# absence of a real GPU.
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV MESA_GL_VERSION_OVERRIDE=3.3
ENV MESA_GLSL_VERSION_OVERRIDE=330

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot 4.3 headless environment with software OpenGL/Vulkan for SubViewport render-to-texture tests."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#                   unzip xz-utils xvfb xauth and X/GL/Vulkan client libraries
#                   plus mesa-vulkan-drivers and libgl1-mesa-dri for software rendering.
#   - pip3 packages: pytest-json-ctrf
#   - Godot 4.3-stable Linux binary installed at /opt/godot/godot, symlinked to /usr/local/bin/godot.
#   - /home/user/myproject: scaffolded Godot 4 project with a minimal project.godot.
