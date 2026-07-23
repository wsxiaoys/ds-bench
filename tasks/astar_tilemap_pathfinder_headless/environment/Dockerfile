FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10.2

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV GRADLE_HOME=/opt/gradle
ENV PATH=/opt/gradle/bin:/usr/lib/jvm/java-17-openjdk-amd64/bin:/usr/local/bin:/usr/bin:/bin

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s /opt/gradle-${GRADLE_VERSION} /opt/gradle && \
    ln -s /opt/gradle/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# ---------------------------------------------------------------------------
# Pre-warm the offline dependency cache for libGDX 1.14.2 (core + headless
# backend + desktop natives) and JUnit by resolving them once with network
# access at image-build time. Later builds run fully offline from this cache.
# ---------------------------------------------------------------------------
RUN mkdir -p /opt/prewarm/src/main/java/app /opt/prewarm/src/test/java/app && \
    cat > /opt/prewarm/settings.gradle <<'EOF'
rootProject.name = 'prewarm'
EOF

RUN cat > /opt/prewarm/build.gradle <<'EOF'
plugins {
    id 'application'
}
repositories {
    mavenCentral()
}
dependencies {
    implementation 'com.badlogicgames.gdx:gdx:1.14.2'
    implementation 'com.badlogicgames.gdx:gdx-backend-headless:1.14.2'
    runtimeOnly 'com.badlogicgames.gdx:gdx-platform:1.14.2:natives-desktop'
    testImplementation 'junit:junit:4.13.2'
}
application {
    mainClass = 'app.Main'
}
EOF

RUN cat > /opt/prewarm/src/main/java/app/Main.java <<'EOF'
package app;

import com.badlogic.gdx.backends.headless.HeadlessApplication;
import com.badlogic.gdx.utils.BinaryHeap;

public class Main {
    public static void main(String[] args) {
        // Reference libGDX classes so the resolver caches the artifacts.
        Class<?> a = HeadlessApplication.class;
        Class<?> b = BinaryHeap.class;
        System.out.println(a.getName() + " " + b.getName());
    }
}
EOF

RUN cat > /opt/prewarm/src/test/java/app/AppTest.java <<'EOF'
package app;

import org.junit.Test;
import static org.junit.Assert.assertTrue;

public class AppTest {
    @Test
    public void smoke() {
        assertTrue(true);
    }
}
EOF

RUN cd /opt/prewarm && \
    gradle --no-daemon build && \
    gradle --no-daemon run

# Force all subsequent Gradle builds to run offline (no network at task time).
RUN mkdir -p /root/.gradle/init.d && \
    cat > /root/.gradle/init.d/offline.gradle <<'EOF'
gradle.startParameter.offline = true
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless-backend Java environment (JDK 17 + Gradle 8.10.2) with an offline-primed dependency cache for a weighted A* tilemap pathfinder task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - OpenJDK 17 (JAVA_HOME set) and Gradle 8.10.2 (on PATH) for building libGDX apps
#   - offline-primed Gradle cache (/root/.gradle) with libGDX 1.14.2 core, gdx-backend-headless,
#     gdx-platform:natives-desktop, and JUnit 4.13.2 resolved from Maven Central
#   - /root/.gradle/init.d/offline.gradle forces all Gradle builds offline (local-only, no runtime network)
#   - /home/user: task working directory root (the executor creates /home/user/astar)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
