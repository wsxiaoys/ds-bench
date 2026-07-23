FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10
ARG GDX_VERSION=1.14.2

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk-headless && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip && \
    mkdir -p /opt/gradle && \
    unzip -q -d /opt/gradle /tmp/gradle.zip && \
    ln -s /opt/gradle/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-warm the Gradle cache so a correct solution can build/run the headless
# module even with `--offline`: download the Gradle wrapper distribution and the
# pinned libGDX headless artifacts (gdx, gdx-backend-headless, gdx-platform
# natives-desktop) into /root/.gradle, which persists for the agent and verifier.
RUN mkdir -p /tmp/warmup && cd /tmp/warmup && \
    printf 'rootProject.name = "warmup"\n' > settings.gradle && \
    printf 'plugins { id "java" }\nrepositories { mavenCentral() }\ndependencies {\n  implementation "com.badlogicgames.gdx:gdx:%s"\n  implementation "com.badlogicgames.gdx:gdx-backend-headless:%s"\n  runtimeOnly "com.badlogicgames.gdx:gdx-platform:%s:natives-desktop"\n}\n' "${GDX_VERSION}" "${GDX_VERSION}" "${GDX_VERSION}" > build.gradle && \
    gradle --no-daemon wrapper --gradle-version ${GRADLE_VERSION} --distribution-type bin && \
    ./gradlew --no-daemon dependencies --configuration runtimeClasspath && \
    cd / && rm -rf /tmp/warmup

RUN mkdir -p /home/user/libgdx-des

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless discrete-event simulator task: JDK 17, Gradle 8.10, pre-warmed libGDX headless dependency cache."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - OpenJDK 17 (headless) + Gradle 8.10 on PATH for building the libGDX headless module
#   - pre-warmed /root/.gradle cache: Gradle 8.10 wrapper distribution and pinned
#     libGDX 1.14.2 artifacts (gdx, gdx-backend-headless, gdx-platform natives-desktop)
#   - /home/user/libgdx-des: working directory for the discrete-event simulator project

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
