FROM ubuntu:24.04

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV GRADLE_HOME=/opt/gradle/gradle-8.10
ENV PATH=${JAVA_HOME}/bin:${GRADLE_HOME}/bin:${PATH}
ENV GRADLE_USER_HOME=/root/.gradle

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip zip openjdk-17-jdk-headless && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    mkdir -p /opt/gradle && \
    curl -fsSL https://services.gradle.org/distributions/gradle-8.10-bin.zip -o /tmp/gradle.zip && \
    unzip -q /tmp/gradle.zip -d /opt/gradle && \
    rm -f /tmp/gradle.zip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/gdx-ecs && chmod 0755 /home/user/gdx-ecs

# Pre-warm the Gradle / Maven Central caches so the first build during evaluation
# does not have to download the full libGDX + Ashley dependency set over the
# network. The coordinates pulled here are exactly the ones required by the task
# (see plan.md / task.json). No project files are left under /home/user.
RUN mkdir -p /tmp/gdx-warmup && cd /tmp/gdx-warmup && \
    printf '%s\n' "rootProject.name = 'gdx-warmup'" > settings.gradle && \
    printf '%s\n' \
        "plugins { id 'java' }" \
        "repositories { mavenCentral() }" \
        "dependencies {" \
        "    implementation 'com.badlogicgames.gdx:gdx:1.13.1'" \
        "    implementation 'com.badlogicgames.gdx:gdx-backend-headless:1.13.1'" \
        "    runtimeOnly    'com.badlogicgames.gdx:gdx-platform:1.13.1:natives-desktop'" \
        "    implementation 'com.badlogicgames.ashley:ashley:1.7.4'" \
        "}" > build.gradle && \
    gradle --no-daemon dependencies --configuration runtimeClasspath > /dev/null && \
    cd / && rm -rf /tmp/gdx-warmup

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX headless backend + Ashley ECS task environment (JDK 17, Gradle 8.10) with /home/user/gdx-ecs prepared."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17-jdk-headless: JDK required to build/run libGDX programs
#   - Gradle 8.10 installed at /opt/gradle/gradle-8.10 (on PATH)
#   - Pre-warmed Gradle cache with libGDX 1.13.1 (core/headless/natives-desktop) and Ashley 1.7.4
#   - /home/user/gdx-ecs: empty project directory the executor populates
