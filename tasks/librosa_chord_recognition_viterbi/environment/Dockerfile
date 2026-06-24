FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libsndfile1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        numpy \
        scipy \
        scikit-learn \
        "soxr>=0.3.2" \
        soundfile \
        pooch \
        librosa==0.11.0 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi

RUN mkdir -p /home/user && chmod 0755 /home/user

# Prepare /workspace with a tonal example audio file (Tchaikovsky's "Dance of the
# Sugar Plum Fairy" from the Nutcracker Suite, distributed by the librosa example
# pack via pooch). The example is downloaded once at build time and copied to
# /home/user/input.wav so the task environment has no runtime network dependency.
RUN mkdir -p /workspace && \
    python3 -c "import shutil, librosa; shutil.copyfile(librosa.ex('nutcracker'), '/home/user/input.wav')" && \
    test -s /home/user/input.wav

LABEL Author="generate-harbor-tasks"
LABEL Description="librosa 0.11.0 chord recognition task environment with a pre-baked tonal WAV at /home/user/input.wav."

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - audio system libraries: ffmpeg, libsndfile1
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: librosa==0.11.0 (+ numpy, scipy, scikit-learn, soxr, soundfile, pooch)
#   - /home/user/input.wav: tonal example baked from librosa.ex('nutcracker')
#   - /home/user: standard user home directory
