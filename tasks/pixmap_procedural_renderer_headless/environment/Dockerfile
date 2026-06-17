FROM ubuntu:24.04

ENV GRADLE_USER_HOME=/home/user/.gradle
ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV GRADLE_HOME=/opt/gradle/gradle-8.10
ENV PATH=/opt/gradle/gradle-8.10/bin:/usr/lib/jvm/java-21-openjdk-amd64/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        openjdk-21-jdk-headless unzip zip libfreetype6 fontconfig && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf pillow && \
    wget -q https://services.gradle.org/distributions/gradle-8.10-bin.zip -O /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt/gradle && \
    rm -f /tmp/gradle.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Project directory the executor will populate.
RUN mkdir -p /home/user/pixmap-renderer

# Bootstrap a throwaway Gradle project to populate /home/user/.gradle with the
# libGDX core, headless backend, and desktop natives. The actual task will run
# Gradle with --offline against this same cache.
RUN mkdir -p /tmp/bootstrap/src/main/java

RUN cat >/tmp/bootstrap/settings.gradle <<'EOF'
rootProject.name = 'bootstrap'
EOF

RUN cat >/tmp/bootstrap/build.gradle <<'EOF'
plugins {
    id 'java'
    id 'application'
}

repositories {
    mavenCentral()
}

ext.gdxVersion = '1.14.2'

dependencies {
    implementation "com.badlogicgames.gdx:gdx:${gdxVersion}"
    implementation "com.badlogicgames.gdx:gdx-backend-headless:${gdxVersion}"
    runtimeOnly    "com.badlogicgames.gdx:gdx-platform:${gdxVersion}:natives-desktop"
}

application {
    mainClass = 'bootstrap.Main'
}

tasks.register('resolveAll') {
    doLast {
        configurations.runtimeClasspath.resolve()
        configurations.compileClasspath.resolve()
    }
}
EOF

RUN cat >/tmp/bootstrap/src/main/java/Main.java <<'EOF'
package bootstrap;
public class Main { public static void main(String[] args) { } }
EOF

RUN cd /tmp/bootstrap && \
    gradle --no-daemon --quiet resolveAll && \
    gradle --no-daemon --quiet assemble && \
    rm -rf /tmp/bootstrap

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless-backend task environment with JDK 21, Gradle 8.10, and a pre-populated offline dependency cache."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - JDK 21 (headless) and Gradle 8.10 for building the libGDX project.
#   - Pre-populated Gradle dependency cache at /home/user/.gradle for offline builds of:
#       * com.badlogicgames.gdx:gdx:1.14.2
#       * com.badlogicgames.gdx:gdx-backend-headless:1.14.2
#       * com.badlogicgames.gdx:gdx-platform:1.14.2:natives-desktop
#   - Pillow installed for PNG verification in the final-state tests.
#   - /home/user/pixmap-renderer: empty project directory the executor must populate.
