FROM ubuntu:24.04

ENV GRADLE_VERSION=8.10 \
    GRADLE_HOME=/opt/gradle \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    PATH=/opt/gradle/bin:/usr/lib/jvm/java-17-openjdk-amd64/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        openjdk-17-jdk unzip && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    mv "/opt/gradle-${GRADLE_VERSION}" /opt/gradle && \
    rm -f /tmp/gradle.zip && \
    ln -s /opt/gradle/bin/gradle /usr/local/bin/gradle && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/gdx-game && chmod 0755 /home/user/gdx-game

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX headless backend task environment with OpenJDK 17 and Gradle 8.10 pre-installed."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - OpenJDK 17 (for libGDX 1.14.2 builds and runtime)
#   - Gradle 8.10 installed at /opt/gradle, symlinked to /usr/local/bin/gradle
#   - unzip (used to install Gradle)
#   - /home/user/gdx-game: empty project directory where the executor builds the libGDX headless project
