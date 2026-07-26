FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10

ENV JAVA_HOME=/opt/java
ENV GRADLE_USER_HOME=/root/.gradle

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk-headless && \
    ln -s "$(dirname "$(dirname "$(readlink -f "$(which javac)")")")" /opt/java && \
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

# Pre-warm the Gradle dependency cache with the exact libGDX 1.14.2 artifacts
# (core, headless backend, native platform, and the transitive shared-library
# loader) plus the Gradle wrapper distribution, so builds are fast and reliable.
RUN mkdir -p /tmp/warm && cd /tmp/warm && \
    printf '%s\n' \
      "plugins { id 'application' }" \
      "repositories { mavenCentral() }" \
      "dependencies {" \
      "  implementation 'com.badlogicgames.gdx:gdx:1.14.2'" \
      "  implementation 'com.badlogicgames.gdx:gdx-backend-headless:1.14.2'" \
      "  runtimeOnly 'com.badlogicgames.gdx:gdx-platform:1.14.2:natives-desktop'" \
      "}" \
      "application { mainClass = 'Warm' }" \
      "task warmCache(type: Copy) {" \
      "  from configurations.runtimeClasspath" \
      "  into layout.buildDirectory.dir('warm')" \
      "}" > build.gradle && \
    echo "rootProject.name = 'warm'" > settings.gradle && \
    gradle --no-daemon --console=plain wrapper --gradle-version ${GRADLE_VERSION} --distribution-type bin && \
    gradle --no-daemon --console=plain warmCache && \
    cd / && rm -rf /tmp/warm

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the empty project directory and drop a small illustrative sample scene
# (NOT used by the verifier) so the format is easy to inspect.
RUN mkdir -p /home/user/scene-baker && \
    cat >/home/user/scene-baker/sample-scene.json <<'EOF'
{
  "type": "group",
  "name": "demo",
  "lx": 0, "ly": 0, "ls": 1,
  "children": [
    {
      "type": "sprite",
      "name": "box",
      "lx": 1, "ly": 2, "ls": 1,
      "region": "box.png",
      "z": 0,
      "frames": [0]
    },
    {
      "type": "light",
      "name": "lamp",
      "enabled": false,
      "lx": 0, "ly": 0, "ls": 1,
      "color": "ffffff",
      "intensity": 1.0
    }
  ]
}
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless JSON task: JDK 17 + Gradle 8.10 with pre-warmed gdx dependency cache."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17-jdk-headless: JDK to compile/run the libGDX headless app
#   - Gradle 8.10 installed at /opt/gradle and linked to /usr/local/bin/gradle
#   - pre-warmed Gradle cache (/root/.gradle) with libGDX 1.14.2 core/headless/platform artifacts and the 8.10 wrapper distribution
#   - /home/user/scene-baker: empty project directory the executor works in
#   - /home/user/scene-baker/sample-scene.json: illustrative (non-graded) sample input

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
