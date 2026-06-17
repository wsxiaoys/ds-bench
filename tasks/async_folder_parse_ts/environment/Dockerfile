FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf "llama-cloud>=2.7,<3" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the starter project: package.json, tsconfig, and download three sample PDFs.
RUN mkdir -p /home/user/myproject/inputs && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "async-folder-parse",
  "version": "1.0.0",
  "type": "module",
  "private": true
}
EOF

RUN cd /home/user/myproject && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
EOF

# Download three small public-domain research PDFs as the input corpus.
RUN cd /home/user/myproject/inputs && \
    curl -fsSL -o attention.pdf https://arxiv.org/pdf/1706.03762.pdf && \
    curl -fsSL -o bert.pdf      https://arxiv.org/pdf/1810.04805.pdf && \
    curl -fsSL -o gpt3.pdf      https://arxiv.org/pdf/2005.14165.pdf && \
    test -s attention.pdf && test -s bert.pdf && test -s gpt3.pdf

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud async folder parse (TypeScript) task environment with Node.js v24 and three sample PDFs."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (provides node + npm) for running TypeScript via `npx tsx`
#   - Python `llama-cloud` (v2) SDK used by the verifier to check external_file_id tagging
#   - /home/user/myproject: starter Node project with package.json + tsconfig.json
#   - /home/user/myproject/inputs/{attention,bert,gpt3}.pdf: three sample PDFs to parse
