FROM ubuntu:24.04

ARG POCHI_VERSION
ARG GRADLE_VERSION=8.10
ARG GDX_VERSION=1.14.2

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV GRADLE_USER_HOME=/root/.gradle
ENV PATH=/usr/local/bin:${JAVA_HOME}/bin:${PATH}

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        unzip openjdk-17-jdk && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install a pinned Gradle distribution (no wrapper download needed at task time).
RUN curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip" -o /tmp/gradle.zip && \
    mkdir -p /opt/gradle && \
    unzip -q /tmp/gradle.zip -d /opt/gradle && \
    ln -s /opt/gradle/gradle-${GRADLE_VERSION}/bin/gradle /usr/local/bin/gradle && \
    rm -f /tmp/gradle.zip

# Pre-warm the Gradle dependency cache with the pinned libGDX headless artifacts so
# the task can be built and run fully offline (no network access at task/test time).
RUN mkdir -p /tmp/warmup/src/main/java && \
    printf 'rootProject.name = "warmup"\n' > /tmp/warmup/settings.gradle && \
    printf 'apply plugin: "java"\napply plugin: "application"\nrepositories { mavenCentral() }\ndependencies {\n  implementation "com.badlogicgames.gdx:gdx:%s"\n  implementation "com.badlogicgames.gdx:gdx-backend-headless:%s"\n  runtimeOnly "com.badlogicgames.gdx:gdx-platform:%s:natives-desktop"\n}\napplication { mainClass = "Warmup" }\n' "${GDX_VERSION}" "${GDX_VERSION}" "${GDX_VERSION}" > /tmp/warmup/build.gradle && \
    printf 'import com.badlogic.gdx.backends.headless.HeadlessApplication;\nimport com.badlogic.gdx.utils.BinaryHeap;\npublic class Warmup {\n  public static void main(String[] args) {\n    System.out.println(HeadlessApplication.class.getName() + " " + BinaryHeap.class.getName());\n  }\n}\n' > /tmp/warmup/src/main/java/Warmup.java && \
    cd /tmp/warmup && \
    gradle --no-daemon build && \
    rm -rf /tmp/warmup

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="libGDX 1.14.2 headless task environment: JDK 17, Gradle 8.10, and a pre-warmed offline dependency cache for the discrete-event scheduler task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - openjdk-17-jdk (java/javac) + unzip for building libGDX Java projects
#   - Gradle 8.10 installed at /opt/gradle, symlinked to /usr/local/bin/gradle
#   - Pre-warmed /root/.gradle cache with libGDX 1.14.2 gdx + gdx-backend-headless + gdx-platform:natives-desktop
#     so the task builds and runs fully offline
#   - /home/user/project: empty project directory for the executor's solution

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
