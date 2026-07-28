FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10
ARG GDX_VERSION=1.14.2

ENV JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
ENV GRADLE_USER_HOME=/root/.gradle

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip zip openjdk-21-jdk-headless && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install a global Gradle distribution and expose it on PATH.
RUN curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project

# Warm the Gradle dependency cache and the Gradle wrapper distribution so that
# the project can be built completely offline (no network at task/verify time).
# A throwaway probe project pulls the exact libGDX core + headless backend +
# desktop natives (and their transitive dependencies) into GRADLE_USER_HOME.
RUN mkdir -p /tmp/probe && cd /tmp/probe && \
    printf 'rootProject.name = "probe"\n' > settings.gradle && \
    printf 'plugins { id "java" }\nrepositories { mavenCentral() }\ndependencies {\n  implementation "com.badlogicgames.gdx:gdx:%s"\n  implementation "com.badlogicgames.gdx:gdx-backend-headless:%s"\n  runtimeOnly "com.badlogicgames.gdx:gdx-platform:%s:natives-desktop"\n}\ntask resolveAll {\n  doLast {\n    configurations.compileClasspath.resolve()\n    configurations.runtimeClasspath.resolve()\n  }\n}\n' "${GDX_VERSION}" "${GDX_VERSION}" "${GDX_VERSION}" > build.gradle && \
    gradle wrapper --gradle-version ${GRADLE_VERSION} --distribution-type bin --no-daemon && \
    ./gradlew --no-daemon resolveAll && \
    cd / && rm -rf /tmp/probe

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless build environment (JDK 21 + Gradle 8.10) with a pre-warmed offline dependency cache for a deterministic BSP dungeon generator task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - extra apt packages: unzip zip openjdk-21-jdk-headless (JDK for libGDX/Gradle builds)
#   - always required pip3 packages: pytest-json-ctrf
#   - Gradle 8.10 installed to /opt and symlinked to /usr/local/bin/gradle
#   - Pre-warmed Gradle cache (GRADLE_USER_HOME=/root/.gradle) with libGDX 1.14.2
#     core + gdx-backend-headless + gdx-platform natives-desktop and the 8.10
#     wrapper distribution, enabling fully offline builds
#   - /home/user/project: empty project directory for the executor

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
