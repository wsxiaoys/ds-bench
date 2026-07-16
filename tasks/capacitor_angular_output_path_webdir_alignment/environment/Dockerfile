FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Scaffold an Angular v18 workspace (uses the @angular/build:application builder,
# which emits the compiled site into a `browser` sub-folder of the output path).
RUN npm install -g @angular/cli@^18.2.0 && \
    cd /home/user && \
    NG_CLI_ANALYTICS=ci CI=true ng new mobileapp \
        --routing=false --style=css --ssr=false --skip-git --defaults && \
    cd mobileapp && \
    npm install @capacitor/core@^8.0.0 && \
    npm install -D @capacitor/cli@^8.0.0

# Introduce the friction: the Angular build outputPath and Capacitor's webDir
# are set to two different folder names, and webDir ignores the browser sub-folder.
RUN cd /home/user/mobileapp && \
    node -e "const fs=require('fs');const p='angular.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));j.projects['mobileapp'].architect.build.options.outputPath='dist/webapp';fs.writeFileSync(p,JSON.stringify(j,null,2));console.log('angular.json build outputPath =>',j.projects['mobileapp'].architect.build.options.outputPath);"

RUN cd /home/user/mobileapp && cat > capacitor.config.ts <<'EOF'
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.mobileapp',
  appName: 'Mobile App',
  webDir: 'dist/mobileapp',
};

export default config;
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Angular v18 + Capacitor v8 workspace with a mismatched build outputPath and webDir (CLI-only, no native platforms)."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v22 (satisfies Angular 18 and Capacitor v8 requirements)
#   - Angular CLI v18 (global) for scaffolding/building the workspace
#   - /home/user/mobileapp: Angular v18 workspace with @capacitor/core@8 and @capacitor/cli@8 installed
#   - Intentional friction: angular.json build outputPath = 'dist/webapp',
#     capacitor.config.ts webDir = 'dist/mobileapp' (mismatched names + ignored browser sub-folder)
#   - No android/ios native platforms added (config-only task, CLI verification)

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
