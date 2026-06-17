FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "llama-cloud>=2.7,<3" \
        "pydantic>=2" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/llamacloud-task && \
    cat > /home/user/llamacloud-task/sample_invoice.txt <<'EOF'
=========================================
            INVOICE
=========================================

Vendor: Acme Robotics, Inc.
        1 Industrial Way, Springfield, IL 62704

Invoice Number: INV-2024-9876
Invoice Date:   2024-11-12
Due Date:       2024-12-12

Bill To:
    Northwind Manufacturing
    420 Lakeshore Blvd
    Chicago, IL 60601

-----------------------------------------
Description                       Amount
-----------------------------------------
ServoArm S-200 (qty 3)            1200.00
On-site calibration                249.99
Shipping & handling                 50.00
-----------------------------------------
Subtotal                          1499.99
Tax (0%)                             0.00
-----------------------------------------
Total Amount Due (USD):           1499.99
=========================================

Remit payment to Acme Robotics, Inc. within 30 days of the invoice date.
Reference invoice number INV-2024-9876 on all correspondence.
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud Extract v2 (Python SDK) task environment with a pre-staged invoice fixture for citation-enabled extraction."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target SDK: llama-cloud (v2 Python SDK, version >=2.7,<3) plus pydantic v2 for schema definitions
#   - /home/user/llamacloud-task: project directory for the Extract-with-citations task
#   - /home/user/llamacloud-task/sample_invoice.txt: fixture invoice referenced by the task instructions
