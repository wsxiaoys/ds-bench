FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GODOT_VERSION=4.4.1-stable

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep unzip \
        xvfb xauth \
        libvulkan1 mesa-vulkan-drivers libgl1-mesa-dri libglu1-mesa mesa-utils \
        libx11-6 libxcursor1 libxinerama1 libxrandr2 libxi6 libxext6 libxrender1 \
        libgl1 libegl1 libxkbcommon0 \
        libasound2t64 libpulse0 libudev1 libfontconfig1 libfreetype6 libxcb1 libdbus-1-3 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the standard (Vulkan-capable) Godot 4.4.1 engine binary.
RUN wget -q "https://github.com/godotengine/godot/releases/download/${GODOT_VERSION}/Godot_v${GODOT_VERSION}_linux.x86_64.zip" -O /tmp/godot.zip && \
    unzip -q /tmp/godot.zip -d /tmp/godot && \
    mv "/tmp/godot/Godot_v${GODOT_VERSION}_linux.x86_64" /usr/local/bin/godot && \
    chmod +x /usr/local/bin/godot && \
    rm -rf /tmp/godot /tmp/godot.zip

# Wrapper that launches a Godot project with a software-Vulkan (Mesa lavapipe)
# rendering device so that RenderingDevice / compute pipelines are available
# without any GPU hardware and without network access at runtime.
RUN cat > /usr/local/bin/godot-run <<'EOF'
#!/usr/bin/env bash
set -uo pipefail
PROJ="${1:-/home/user/scan}"
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json
export LIBGL_ALWAYS_SOFTWARE=1
export GALLIUM_DRIVER=llvmpipe
# Best-effort asset (re)import so resource-based shader loading also works.
xvfb-run -a godot --headless --import --path "$PROJ" >/dev/null 2>&1 || true
# Run the project's main scene with a software Vulkan rendering device.
xvfb-run -a godot --rendering-driver vulkan --path "$PROJ" --quit-after 5000
EOF
RUN chmod +x /usr/local/bin/godot-run

RUN mkdir -p /home/user && chmod 0755 /home/user

# Deterministic input fixture: N=5000 non-negative integers (spans multiple GPU
# workgroups). Both the solution and the verifier read this exact file.
RUN mkdir -p /home/user/scan/data && \
    python3 - <<'PY'
n = 5000
vals = [(i * 37 + 11) % 4096 for i in range(n)]
with open('/home/user/scan/data/input.txt', 'w') as f:
    f.write(str(n) + '\n')
    f.write('\n'.join(str(v) for v in vals))
    f.write('\n')
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="Godot 4.4.1 with Mesa lavapipe software-Vulkan + Xvfb for headless GPU compute-shader tasks."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Godot 4.4.1-stable standard (Vulkan) engine at /usr/local/bin/godot
#   - Mesa lavapipe (software Vulkan) + llvmpipe + Xvfb so RenderingDevice/compute shaders run without a GPU
#   - /usr/local/bin/godot-run: launches /home/user/scan with a software-Vulkan rendering device
#   - /home/user/scan: project directory (agent creates project.godot, scene, scripts, and the .glsl compute shader)
#   - /home/user/scan/data/input.txt: deterministic fixture of 5000 non-negative integers

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
