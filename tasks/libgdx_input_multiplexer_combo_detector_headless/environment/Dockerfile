FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        openjdk-17-jdk unzip zip && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/combo-detector

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless-backend task environment: OpenJDK 17 + Gradle 8.10 for building and running a scripted-input InputMultiplexer combo detector."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - OpenJDK 17 (JDK) for compiling/running the libGDX headless Gradle project
#   - Gradle 8.10 installed to /opt and symlinked at /usr/local/bin/gradle (used to bootstrap the ./gradlew wrapper)
#   - JAVA_HOME set to the OpenJDK 17 install path
#   - /home/user/combo-detector: empty project directory the executor populates

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
