FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk-headless && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip && \
    unzip -q /tmp/gradle.zip -d /opt && \
    ln -s /opt/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Pre-warm the Gradle caches: download the pinned libGDX 1.14.2 headless artifacts
# and the Gradle 8.10 wrapper distribution so the agent's build works reliably.
RUN mkdir -p /tmp/warm && cd /tmp/warm && \
    printf 'rootProject.name = "warm"\n' > settings.gradle && \
    printf 'plugins { id "java" }\nrepositories { mavenCentral() }\ndependencies {\n  implementation "com.badlogicgames.gdx:gdx:1.14.2"\n  implementation "com.badlogicgames.gdx:gdx-backend-headless:1.14.2"\n  runtimeOnly "com.badlogicgames.gdx:gdx-platform:1.14.2:natives-desktop"\n}\ntask warm(type: Copy) {\n  from configurations.runtimeClasspath\n  into "$buildDir/warm"\n}\n' > build.gradle && \
    gradle --no-daemon warm && \
    gradle --no-daemon wrapper --gradle-version ${GRADLE_VERSION} --distribution-type bin && \
    ./gradlew --no-daemon --version && \
    cd / && rm -rf /tmp/warm

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/quadtree-broadphase

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless QuadTree broadphase task: JDK 17 + Gradle 8.10 with pre-warmed libGDX dependency and wrapper caches."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17 (JDK) + Gradle 8.10 for building the libGDX headless Gradle project
#   - pre-warmed ~/.gradle caches: libGDX 1.14.2 (gdx, gdx-backend-headless, gdx-platform natives-desktop) and the Gradle 8.10 wrapper distribution
#   - /home/user/quadtree-broadphase: empty project directory the executor fills in

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
