FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep ssh && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests && \
    curl -L https://encore.dev/install.sh | bash && \
    ln -s /root/.encore/bin/encore /usr/local/bin/encore && \
    ln -s /root/.encore/bin/git-remote-encore /usr/local/bin/git-remote-encore && \
    ln -s /root/.encore/bin/tsbundler-encore /usr/local/bin/tsbundler-encore && \
    ln -s /root/.encore/bin/tsparser-encore /usr/local/bin/tsparser-encore && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/express-app && \
    cd /home/user/express-app && \
    cat >package.json <<'EOF'
{
  "name": "express-app",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF
RUN cd /home/user/express-app && \
    cat >index.js <<'EOF'
const express = require('express');
const app = express();
const port = 3000;

app.get('/greet/:name', (req, res) => {
  res.json({ message: `Hello, ${req.params.name}!` });
});

app.listen(port, () => {
  console.log(`Express app listening on port ${port}`);
});
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Task environment with Encore CLI, Node.js v24, and a starting Express.js app."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep ssh
#   - always required pip3 packages: pytest-json-ctrf, requests
#   - Node.js v24
#   - Encore CLI installed via install.sh
#   - /home/user/express-app: Existing Express.js app to be migrated
