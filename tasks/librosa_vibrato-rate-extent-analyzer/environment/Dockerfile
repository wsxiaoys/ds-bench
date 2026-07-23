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
        "numpy>=1.24,<2.1" \
        "scipy>=1.10" \
        "soundfile>=0.12" \
        "librosa==0.11.0" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/vibrato_analyzer && chmod 0755 /home/user/vibrato_analyzer

LABEL Author="generate-harbor-tasks"
LABEL Description="librosa 0.11.0 audio-analysis environment for a vibrato rate & extent analyzer CLI task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - audio deps: libsndfile1 (soundfile backend), ffmpeg
#   - always required pip3 packages: pytest-json-ctrf
#   - task/verifier pip3 packages: numpy, scipy, soundfile, librosa==0.11.0
#   - /home/user/vibrato_analyzer: empty project directory where the agent creates analyze_vibrato.py

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
