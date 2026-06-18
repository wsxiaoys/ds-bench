FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV GRADLE_HOME=/opt/gradle
ENV GRADLE_USER_HOME=/home/user/.gradle
ENV PATH=/opt/gradle/bin:/usr/lib/jvm/java-21-openjdk-amd64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-21-jdk-headless && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Gradle 8.10 (the version pinned by the research plan).
RUN curl -fsSL https://services.gradle.org/distributions/gradle-8.10-bin.zip -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    mv /opt/gradle-8.10 /opt/gradle && \
    rm -f /tmp/gradle.zip && \
    ln -s /opt/gradle/bin/gradle /usr/local/bin/gradle && \
    gradle --version

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/projectile_sim && chmod 0755 /home/user/projectile_sim

# Pre-fetch libGDX 1.14.2 (core + headless backend + desktop natives) into
# /home/user/.gradle so the executor can build offline-friendly Gradle projects.
RUN mkdir -p /tmp/warmup/src/main/java/com/warmup && \
    printf "rootProject.name = 'warmup'\n" > /tmp/warmup/settings.gradle && \
    printf "plugins { id 'java' }\n\
repositories { mavenCentral() }\n\
dependencies {\n\
    implementation 'com.badlogicgames.gdx:gdx:1.14.2'\n\
    implementation 'com.badlogicgames.gdx:gdx-backend-headless:1.14.2'\n\
    runtimeOnly 'com.badlogicgames.gdx:gdx-platform:1.14.2:natives-desktop'\n\
}\n" > /tmp/warmup/build.gradle && \
    printf "package com.warmup;\npublic class WarmUp { public static void main(String[] a){} }\n" > /tmp/warmup/src/main/java/com/warmup/WarmUp.java && \
    cd /tmp/warmup && \
    gradle --no-daemon -q build && \
    cd / && \
    rm -rf /tmp/warmup && \
    chmod -R a+rwX /home/user/.gradle

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless task environment: OpenJDK 21, Gradle 8.10, pre-warmed libGDX dependency cache."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - OpenJDK 21 (java/javac in PATH) for compiling libGDX projects
#   - Gradle 8.10 binary distribution at /opt/gradle (symlinked into /usr/local/bin)
#   - GRADLE_USER_HOME=/home/user/.gradle pre-populated with libGDX 1.14.2 core,
#     headless backend, and desktop natives so the executor can build a Gradle
#     project without re-downloading the heavy artifacts.
#   - /home/user/projectile_sim: empty project directory the executor will populate.
