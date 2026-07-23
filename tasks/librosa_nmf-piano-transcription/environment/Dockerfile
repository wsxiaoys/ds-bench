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
        "librosa==0.11.0" \
        "numpy>=1.23,<2.1" \
        "scipy>=1.10" \
        "soundfile>=0.12" \
        "scikit-learn>=1.3" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the project directory and generate a deterministic sample mixture that the
# agent can use for end-to-end testing. The sample uses the same harmonic-tone signal
# model as the hidden evaluation mixture (fundamental + 6 harmonics with 1/h decay,
# plus low-level Gaussian noise), but a different note sequence and RNG seed.
RUN mkdir -p /home/user/project/data && \
    python3 - <<'PY'
import numpy as np
import librosa
import soundfile as sf

SR = 22050
CHORD_DURATION = 0.7
TOTAL_DURATION = 6.8
# Illustrative sequence (distinct from the hidden evaluation set); pitches in [48, 72]
NOTE_SEQUENCE = [
    (0.2, [55, 59, 62]),
    (1.1, [60, 64]),
    (2.0, [57, 60, 64]),
    (2.9, [62, 65, 69]),
    (3.8, [50 + 3, 53 + 3, 60]),  # -> [53, 56, 60]
    (4.7, [48, 55, 64]),
    (5.6, [59, 62, 67]),
]

def tone(midi, n):
    f0 = float(librosa.midi_to_hz(midi))
    t = np.arange(n) / SR
    s = np.zeros(n)
    for h in range(1, 7):
        s += (1.0 / h) * np.sin(2 * np.pi * h * f0 * t)
    fade = int(0.01 * SR)
    env = np.ones(n)
    env[:fade] = np.linspace(0, 1, fade)
    env[-fade:] = np.linspace(1, 0, fade)
    return s * env

rng = np.random.default_rng(1234)
n_total = int(round(TOTAL_DURATION * SR))
y = np.zeros(n_total)
note_len = int(round(CHORD_DURATION * SR))
for onset, pitches in NOTE_SEQUENCE:
    start = int(round(onset * SR))
    for p in pitches:
        seg = 0.3 * tone(p, note_len)
        end = min(start + note_len, n_total)
        y[start:end] += seg[:end - start]
y += rng.normal(0, 0.01, n_total)
y = 0.9 * y / np.max(np.abs(y))
sf.write("/home/user/project/data/sample_mixture.wav", y.astype(np.float32), SR)
print("wrote sample mixture")
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="librosa NMF template-based polyphonic transcription task: Python audio stack (librosa 0.11.0, numpy, scipy, soundfile, scikit-learn) with a deterministic sample mixture under /home/user/project/data."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - audio system deps: libsndfile1, ffmpeg
#   - always required pip3 packages: pytest-json-ctrf
#   - target library stack: librosa==0.11.0, numpy, scipy, soundfile, scikit-learn
#   - /home/user/project: task project directory
#   - /home/user/project/data/sample_mixture.wav: deterministic sample mixture for agent testing

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
