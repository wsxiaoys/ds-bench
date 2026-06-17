FROM ubuntu:24.04

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV GRADLE_USER_HOME=/root/.gradle
ENV PATH=$JAVA_HOME/bin:$PATH

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        openjdk-17-jdk unzip zip && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Gradle 8.10 (matches the version referenced by the libGDX research plan).
RUN cd /opt && \
    wget -q https://services.gradle.org/distributions/gradle-8.10-bin.zip -O gradle.zip && \
    unzip -q gradle.zip && \
    rm gradle.zip && \
    ln -s /opt/gradle-8.10/bin/gradle /usr/local/bin/gradle && \
    gradle --version

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject && chmod 0755 /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless polygon-geometry CLI task environment (OpenJDK 17 + Gradle 8.10)."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - OpenJDK 17 (JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64) for Java compilation and execution
#   - Gradle 8.10 installed under /opt/gradle-8.10 with /usr/local/bin/gradle symlink
#   - Empty /home/user/myproject placeholder for the libGDX headless project the agent will build
