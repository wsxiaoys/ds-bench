FROM ubuntu:24.04

# Install required apt packages and a JDK for the libGDX 1.14.x toolchain.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip zip openjdk-17-jdk && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Gradle 8.10 (the libGDX 1.14.x docs target Gradle 8.x).
ENV GRADLE_VERSION=8.10
RUN curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    rm /tmp/gradle.zip && \
    ln -s "/opt/gradle-${GRADLE_VERSION}/bin/gradle" /usr/local/bin/gradle

# Make JAVA_HOME explicit for tooling that asks for it.
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=${JAVA_HOME}/bin:${PATH}

# Pre-warm libGDX's Maven Central artifacts so the executor can build and run
# without paying a long first-time dependency download. The warm step is
# best-effort: failures here are tolerated because the final-state tests
# re-run the build and will surface real problems.
RUN mkdir -p /tmp/gdx-warm && \
    printf '%s\n' "rootProject.name = 'gdx-warm'" > /tmp/gdx-warm/settings.gradle && \
    printf '%s\n' \
        "plugins { id 'java' }" \
        "repositories { mavenCentral() }" \
        "dependencies {" \
        "    implementation 'com.badlogicgames.gdx:gdx:1.14.2'" \
        "    implementation 'com.badlogicgames.gdx:gdx-backend-headless:1.14.2'" \
        "    runtimeOnly    'com.badlogicgames.gdx:gdx-platform:1.14.2:natives-desktop'" \
        "}" \
        > /tmp/gdx-warm/build.gradle && \
    (cd /tmp/gdx-warm && gradle --no-daemon --refresh-dependencies dependencies > /tmp/gdx-warm.log 2>&1 || true) && \
    rm -rf /tmp/gdx-warm

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless backend task environment for Scene2D Action replay: JDK 17, Gradle 8.10, libGDX artifacts pre-warmed."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17-jdk for libGDX's Java toolchain
#   - Gradle 8.10 installed under /opt and symlinked to /usr/local/bin/gradle
#   - libGDX 1.14.2 core, gdx-backend-headless, and gdx-platform:natives-desktop pre-warmed in the local Gradle/Maven caches
#   - /home/user: empty working area where the executor creates the `gdx-stage-sim` Gradle project
