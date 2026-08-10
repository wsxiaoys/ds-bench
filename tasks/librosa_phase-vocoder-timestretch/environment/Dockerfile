FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        libsndfile1 ffmpeg && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "numpy==1.26.4" \
        "scipy==1.13.1" \
        "soundfile==0.12.1" \
        "librosa==0.11.0" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project

# Generate a deterministic sample mono WAV for local development.
# 220 Hz sustained tone (with fades) plus five broadband click bursts.
RUN python3 - <<'EOF'
import numpy as np
import soundfile as sf

sr = 22050
dur = 3.0
n = int(round(sr * dur))
t = np.arange(n) / sr
tone = 0.3 * np.sin(2.0 * np.pi * 220.0 * t)

fade_in = int(round(0.3 * sr))
fade_out = int(round(0.1 * sr))
env = np.ones(n)
env[:fade_in] = np.linspace(0.0, 1.0, fade_in, endpoint=False)
env[n - fade_out:] = np.linspace(1.0, 0.0, fade_out)
signal = tone * env

rng = np.random.default_rng(0)
burst_len = int(round(0.005 * sr))
decay = np.exp(-np.linspace(0.0, 5.0, burst_len))
for ct in [0.5, 1.0, 1.5, 2.0, 2.5]:
    start = int(round(ct * sr))
    burst = rng.standard_normal(burst_len) * decay
    peak = np.max(np.abs(burst))
    if peak > 0:
        burst = 0.8 * burst / peak
    signal[start:start + burst_len] += burst

sf.write("/home/user/project/input.wav", signal.astype(np.float32), sr, subtype="FLOAT")
print("Wrote /home/user/project/input.wav")
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="librosa phase-vocoder time-stretch and pitch-shift task environment with a deterministic sample WAV."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - audio system dependency: libsndfile1 (for soundfile), ffmpeg
#   - target library: librosa 0.11.0 with numpy 1.26.4, scipy 1.13.1, soundfile 0.12.1
#   - /home/user/project: task working directory (agent writes run.py here)
#   - /home/user/project/input.wav: deterministic sample mono WAV for local development

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
