FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10
ARG GDX_VERSION=1.14.2

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk maven && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf pillow && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install a pinned Gradle distribution and expose it on PATH.
RUN wget -q https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip -O /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

# Pre-warm the Gradle dependency cache with the pinned libGDX headless artifacts so
# the project can be built and run fully offline (no network at task/test time).
RUN mkdir -p /tmp/gdxwarm && cd /tmp/gdxwarm && \
    printf 'rootProject.name = "gdxwarm"\n' > settings.gradle && \
    printf 'plugins { id "java" }\nrepositories { mavenCentral() }\ndependencies {\n  implementation "com.badlogicgames.gdx:gdx:%s"\n  implementation "com.badlogicgames.gdx:gdx-backend-headless:%s"\n  runtimeOnly "com.badlogicgames.gdx:gdx-platform:%s:natives-desktop"\n}\n' "${GDX_VERSION}" "${GDX_VERSION}" "${GDX_VERSION}" > build.gradle && \
    gradle --no-daemon dependencies --configuration runtimeClasspath && \
    gradle --no-daemon dependencies --configuration compileClasspath && \
    rm -rf /tmp/gdxwarm

# Pre-warm the Maven local repository with the same artifacts as a fallback build path.
RUN mvn -B -q dependency:get -Dartifact=com.badlogicgames.gdx:gdx:${GDX_VERSION} && \
    mvn -B -q dependency:get -Dartifact=com.badlogicgames.gdx:gdx-backend-headless:${GDX_VERSION} && \
    mvn -B -q dependency:get -Dartifact=com.badlogicgames.gdx:gdx-platform:${GDX_VERSION}:jar:natives-desktop

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/pixmap-compositor

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless build environment (JDK 17, Gradle 8.10, Maven) with pre-warmed offline dependency caches for a Pixmap/PixmapIO layer compositor task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17-jdk (java + javac), Gradle 8.10 (pinned), Maven for building the libGDX headless app
#   - pip3 pillow: used by the final-state test to decode the produced PNG
#   - pre-warmed Gradle cache (/root/.gradle) and Maven repo (/root/.m2) with libGDX
#     gdx, gdx-backend-headless, and gdx-platform:natives-desktop 1.14.2 for offline builds
#   - /home/user/pixmap-compositor: empty project directory for the task

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
