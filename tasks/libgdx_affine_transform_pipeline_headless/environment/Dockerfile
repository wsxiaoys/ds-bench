FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Resolve the actual JDK home (architecture independent) and install Gradle.
RUN ln -s "$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")" /opt/java-home && \
    curl -fsSL -o /tmp/gradle.zip "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s "/opt/gradle-${GRADLE_VERSION}/bin/gradle" /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip

ENV JAVA_HOME=/opt/java-home
ENV GRADLE_USER_HOME=/home/user/.gradle

RUN mkdir -p /home/user && chmod 0755 /home/user

# Preconfigured libGDX (headless) Gradle project. The task executor implements
# the main class com.example.affine.HeadlessLauncher and its supporting classes.
RUN mkdir -p /home/user/affine-pipeline && \
    cd /home/user/affine-pipeline && \
    cat > settings.gradle <<'EOF'
rootProject.name = 'affine-pipeline'
EOF
RUN cd /home/user/affine-pipeline && \
    cat > build.gradle <<'EOF'
plugins {
    id 'application'
}

repositories {
    mavenCentral()
}

ext {
    gdxVersion = '1.14.2'
}

dependencies {
    implementation "com.badlogicgames.gdx:gdx:$gdxVersion"
    implementation "com.badlogicgames.gdx:gdx-backend-headless:$gdxVersion"
    runtimeOnly "com.badlogicgames.gdx:gdx-platform:$gdxVersion:natives-desktop"
}

application {
    mainClass = 'com.example.affine.HeadlessLauncher'
}
EOF

# Warm the Gradle distribution and the libGDX dependency cache (including the
# desktop natives) so the project builds and runs fully offline afterwards.
# A throwaway stub main class is used only to force resolution/compilation and
# is removed afterwards, leaving the source tree empty for the executor.
RUN cd /home/user/affine-pipeline && \
    mkdir -p src/main/java/com/example/affine && \
    cat > src/main/java/com/example/affine/HeadlessLauncher.java <<'EOF'
package com.example.affine;

public class HeadlessLauncher {
    public static void main(String[] args) {
        // Warm-up stub; replaced by the task executor.
    }
}
EOF
RUN cd /home/user/affine-pipeline && \
    gradle --no-daemon build && \
    gradle --no-daemon run && \
    rm -rf src build .gradle

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless Gradle project (JDK 17, Gradle 8.10) with dependencies pre-cached for offline builds."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17-jdk (JAVA_HOME=/opt/java-home) and Gradle 8.10 (/usr/local/bin/gradle)
#   - GRADLE_USER_HOME=/home/user/.gradle with libGDX 1.14.2 core + headless backend + natives-desktop pre-cached
#   - /home/user/affine-pipeline: preconfigured Gradle project (settings.gradle, build.gradle); empty source tree for the executor

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
