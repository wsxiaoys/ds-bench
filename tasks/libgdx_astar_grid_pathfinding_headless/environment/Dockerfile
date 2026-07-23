FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10
ARG GDX_VERSION=1.14.2

# Gradle and the libGDX artifacts must be resolvable offline at test time. Pin a single
# Gradle user home so both the build-time warm-up and the runtime `./gradlew` share the
# same cache. This is intentionally NOT the HOME env.
ENV GRADLE_USER_HOME=/home/user/.gradle

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk-headless && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install a pinned Gradle distribution and expose it on PATH.
RUN curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip && \
    gradle --version

RUN mkdir -p /home/user && chmod 0755 /home/user

# Warm up the offline caches: download the Gradle wrapper distribution and every required
# libGDX 1.14.2 artifact (core, headless backend, and the desktop natives), and exercise
# the headless runtime path so the native libraries are fetched too. After this build step,
# `./gradlew --offline run` works without any network access.
RUN mkdir -p /tmp/warmup/src/main/java && \
    cd /tmp/warmup && \
    printf '%s\n' \
        "plugins { id 'application' }" \
        "repositories { mavenCentral() }" \
        "dependencies {" \
        "  implementation \"com.badlogicgames.gdx:gdx:${GDX_VERSION}\"" \
        "  implementation \"com.badlogicgames.gdx:gdx-backend-headless:${GDX_VERSION}\"" \
        "  runtimeOnly \"com.badlogicgames.gdx:gdx-platform:${GDX_VERSION}:natives-desktop\"" \
        "}" \
        "application { mainClass = 'Warmup' }" \
        > build.gradle && \
    printf '%s\n' \
        "import com.badlogic.gdx.ApplicationAdapter;" \
        "import com.badlogic.gdx.Gdx;" \
        "import com.badlogic.gdx.backends.headless.HeadlessApplication;" \
        "public class Warmup {" \
        "  public static void main(String[] args) {" \
        "    new HeadlessApplication(new ApplicationAdapter() {" \
        "      public void create() { Gdx.app.exit(); }" \
        "    });" \
        "  }" \
        "}" \
        > src/main/java/Warmup.java && \
    gradle wrapper --gradle-version ${GRADLE_VERSION} --distribution-type bin --no-daemon && \
    ./gradlew --no-daemon run && \
    cd / && rm -rf /tmp/warmup

# Empty working directory the executor will populate.
RUN mkdir -p /home/user/gdx-astar

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless backend + JDK 17 + Gradle 8.10 with offline-primed caches for a weighted A* grid pathfinding CLI task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17 (JDK) + unzip for building the Gradle project
#   - Gradle 8.10 installed at /opt/gradle-8.10 (symlinked to /usr/local/bin/gradle)
#   - GRADLE_USER_HOME=/home/user/.gradle primed offline with: the Gradle 8.10 wrapper
#     distribution and libGDX 1.14.2 artifacts (gdx, gdx-backend-headless, gdx-platform
#     natives-desktop), validated by booting a HeadlessApplication during build
#   - /home/user/gdx-astar: empty project working directory for the executor

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
