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
        numpy==2.0.2 \
        scipy==1.13.1 \
        soundfile==0.13.1 \
        librosa==0.11.0 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the project layout and generate the deterministic input clip.
# The generator is embedded here (COPY is not allowed) and removed afterwards so
# only the resulting WAV remains in the project directory.
RUN mkdir -p /home/user/vqt/input /home/user/vqt/output

RUN cat >/root/make_input.py <<'EOF'
import os
import numpy as np
import soundfile as sf

SR = 22050
N_SAMPLES = 102400
SEED = 20240723
FREQS = [130.81, 164.81, 196.0, 261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5]

rng = np.random.default_rng(SEED)
t = np.arange(N_SAMPLES) / SR
y = np.zeros(N_SAMPLES, dtype=np.float64)
for i, f in enumerate(FREQS):
    amp = 0.5 + 0.5 * np.cos(0.4 * i)
    y += amp * np.sin(2.0 * np.pi * f * t + 0.7 * i)
y += 0.02 * rng.standard_normal(N_SAMPLES)
y = (y / float(np.max(np.abs(y)))) * 0.9
out_path = "/home/user/vqt/input/signal.wav"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
sf.write(out_path, y.astype(np.float32), SR, subtype="FLOAT")
print("Wrote", out_path, len(y), "samples @", SR, "Hz")
EOF

RUN python3 /root/make_input.py && rm -f /root/make_input.py

LABEL Author="generate-harbor-tasks"
LABEL Description="librosa 0.11.0 Variable-Q Transform analysis & reconstruction task; deterministic synthetic input clip at /home/user/vqt/input/signal.wav."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - extra apt packages: libsndfile1, ffmpeg (audio I/O backends for soundfile/librosa)
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: librosa==0.11.0 (+ numpy==2.0.2, scipy==1.13.1, soundfile==0.13.1)
#   - /home/user/vqt: project directory (input/ and output/ subfolders)
#   - /home/user/vqt/input/signal.wav: deterministic mono 22050 Hz, 102400-sample FLOAT WAV

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
