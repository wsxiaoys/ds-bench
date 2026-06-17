FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages pytest-json-ctrf llama-cloud==2.7.0 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/myproject/data && \
    curl -fsSL -o /home/user/myproject/data/turing+imagenet+attention.pdf \
        "https://raw.githubusercontent.com/run-llama/llama_cloud_services/main/examples/split/document_splitting/data/turing%2Bimagenet%2Battention.pdf" && \
    cat >/home/user/myproject/data/categories.json <<'EOF'
{
  "categories": [
    {
      "name": "essay",
      "description": "A philosophical or reflective piece of writing that presents personal viewpoints, arguments, or thoughts on a topic without strict formal structure"
    },
    {
      "name": "research_paper",
      "description": "A formal academic document presenting original research, methodology, experiments, results, and conclusions with citations and references"
    }
  ]
}
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud Split (beta) task environment: Python 3 with llama-cloud SDK and a bundled multi-document PDF fixture for the Split CLI task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud==2.7.0 (target SDK)
#   - /home/user/myproject: working directory for the task
#   - /home/user/myproject/data/turing+imagenet+attention.pdf: bundled concatenated PDF fixture (Turing essay + ImageNet + Attention Is All You Need)
#   - /home/user/myproject/data/categories.json: pre-baked categories config used by the verifier
