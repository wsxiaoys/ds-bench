FROM ubuntu:24.04

# --- Base system + Python tooling --------------------------------------------
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip zip xz-utils tar openssh-client && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# --- Java 17 (Temurin) and Gradle 8.10 --------------------------------------
ENV JAVA_HOME=/opt/jdk-17
ENV GRADLE_HOME=/opt/gradle-8.10
ENV GRADLE_USER_HOME=/root/.gradle
ENV PATH=${JAVA_HOME}/bin:${GRADLE_HOME}/bin:${PATH}

RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) jdk_url='https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.12_7.tar.gz' ;; \
        arm64) jdk_url='https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.12%2B7/OpenJDK17U-jdk_aarch64_linux_hotspot_17.0.12_7.tar.gz' ;; \
        *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac; \
    mkdir -p /opt && \
    curl -fsSL "$jdk_url" -o /tmp/jdk.tar.gz && \
    tar -xzf /tmp/jdk.tar.gz -C /opt && \
    mv "/opt/$(ls /opt | grep -E '^jdk-17')" "$JAVA_HOME" && \
    rm /tmp/jdk.tar.gz && \
    curl -fsSL https://services.gradle.org/distributions/gradle-8.10-bin.zip -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    rm /tmp/gradle.zip && \
    java -version && \
    gradle --version

# --- Pre-warm the Gradle cache with libGDX 1.14.2 (offline-friendly) ---------
# Building a throwaway Gradle project so all libGDX + headless + natives jars
# end up in /root/.gradle, allowing the task executor to work without network
# access when the verifier runs.
RUN set -eux; \
    mkdir -p /opt/gdx-warm/src/main/java/warm; \
    cd /opt/gdx-warm; \
    cat > settings.gradle <<'EOF'
rootProject.name = 'gdx-warm'
EOF
RUN cat > /opt/gdx-warm/build.gradle <<'EOF'
plugins {
    id 'java'
    id 'application'
}

repositories {
    mavenCentral()
}

ext { gdxVersion = '1.14.2' }

dependencies {
    implementation "com.badlogicgames.gdx:gdx:${gdxVersion}"
    implementation "com.badlogicgames.gdx:gdx-backend-headless:${gdxVersion}"
    runtimeOnly    "com.badlogicgames.gdx:gdx-platform:${gdxVersion}:natives-desktop"
}

application {
    mainClass = 'warm.Warm'
}
EOF
RUN cat > /opt/gdx-warm/src/main/java/warm/Warm.java <<'EOF'
package warm;

import com.badlogic.gdx.ApplicationAdapter;
import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.backends.headless.HeadlessApplicationConfiguration;

public class Warm {
    public static void main(String[] args) {
        HeadlessApplicationConfiguration cfg = new HeadlessApplicationConfiguration();
        cfg.updatesPerSecond = 60;
        new HeadlessApplication(new ApplicationAdapter() {
            int ticks = 0;
            @Override public void render() {
                if (++ticks > 2) Gdx.app.exit();
            }
        }, cfg);
    }
}
EOF

RUN cd /opt/gdx-warm && \
    gradle --no-daemon build && \
    gradle --no-daemon run && \
    # Keep the populated Gradle cache, but drop the throwaway project to save space.
    rm -rf /opt/gdx-warm/build /opt/gdx-warm/.gradle

# --- User project directory --------------------------------------------------
RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/turn-based-game

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX headless backend task environment (JDK 17, Gradle 8.10, gdx 1.14.2 cache pre-warmed) for the turn_based_command_loop_headless task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - JDK 17 (Temurin) at /opt/jdk-17 with JAVA_HOME exported
#   - Gradle 8.10 at /opt/gradle-8.10 on PATH
#   - /root/.gradle: pre-warmed Gradle cache containing libGDX 1.14.2 core,
#     gdx-backend-headless 1.14.2, and gdx-platform 1.14.2 natives-desktop
#   - /home/user/turn-based-game: empty target project directory where the
#     executor must create the multi-module Gradle project for the task
