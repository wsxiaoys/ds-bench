FROM ubuntu:24.04

ARG POCHI_VERSION

ENV GRADLE_USER_HOME=/home/user/.gradle
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk-headless && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://services.gradle.org/distributions/gradle-8.10-bin.zip -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s /opt/gradle-8.10/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

WORKDIR /home/user/project

RUN cat > settings.gradle <<'EOF'
rootProject.name = 'project'
EOF

RUN cat > build.gradle <<'EOF'
plugins {
    id 'application'
}

repositories {
    mavenCentral()
}

def gdxVersion = '1.14.2'

dependencies {
    implementation "com.badlogicgames.gdx:gdx:$gdxVersion"
    implementation "com.badlogicgames.gdx:gdx-backend-headless:$gdxVersion"
    runtimeOnly "com.badlogicgames.gdx:gdx-platform:$gdxVersion:natives-desktop"
}

application {
    mainClass = 'com.example.Main'
}

tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
}
EOF

RUN mkdir -p src/main/java/com/example && cat > src/main/java/com/example/Main.java <<'EOF'
package com.example;

/**
 * Placeholder entry point. Replace this with the spatial-hash broad-phase
 * collision simulation described in the task instructions. The simulation must
 * run under a libGDX HeadlessApplication, read the input file given as the first
 * program argument, and write the results to the file given as the second
 * program argument.
 */
public class Main {
    public static void main(String[] args) {
        // Implement the simulation here.
    }
}
EOF

RUN gradle wrapper --gradle-version 8.10 --distribution-type bin && \
    chmod +x gradlew && \
    ./gradlew --no-daemon --console=plain build && \
    ./gradlew --no-daemon --console=plain dependencies --configuration runtimeClasspath > /dev/null && \
    ./gradlew --no-daemon --console=plain --stop || true

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless Gradle application skeleton at /home/user/project with dependencies cached offline for a spatial-hash broad-phase collision simulation task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17 (JDK) and standalone Gradle 8.10 for building the libGDX headless app
#   - GRADLE_USER_HOME=/home/user/.gradle with libGDX 1.14.2 (core, headless backend,
#     natives-desktop) resolved and cached for offline (--offline) builds
#   - /home/user/project: pre-seeded single-module Gradle 'application' project with the
#     Gradle wrapper (gradlew) and a placeholder com.example.Main to be implemented

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
