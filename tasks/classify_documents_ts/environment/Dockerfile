FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject/samples

RUN cat >/home/user/myproject/package.json <<'EOF'
{
  "name": "classify-documents-ts",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "classify": "tsx classify.ts"
  },
  "dependencies": {
    "@llamaindex/llama-cloud": "^2.4.1"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  }
}
EOF

RUN cat >/home/user/myproject/tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": false,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": false,
    "noEmit": true
  },
  "include": ["*.ts"]
}
EOF

RUN cat >/home/user/myproject/samples/invoice.txt <<'EOF'
INVOICE

Invoice Number: INV-2024-00187
Invoice Date: 2024-03-15
Due Date: 2024-04-14

Bill To:
Acme Corporation
123 Business Avenue
San Francisco, CA 94105
USA

From:
Sunrise Consulting LLC
456 Market Street
San Francisco, CA 94103

Line Items:
  1. Software development services (40 hours @ $150/hr) ... $6,000.00
  2. Project management (10 hours @ $120/hr) ............... $1,200.00
  3. Cloud infrastructure setup (one-time fee) ............. $1,500.00

Subtotal: $8,700.00
Tax (8.5%): $739.50
Total Due: $9,439.50

Payment Terms: Net 30
Please remit payment to the bank account on file.
EOF

RUN cat >/home/user/myproject/samples/receipt.txt <<'EOF'
COFFEE & MORE
221 Mission Street
San Francisco, CA

Date: 2024-04-02   Time: 08:47
Cashier: Jamie

1 x Latte (12oz)             $5.50
1 x Blueberry Muffin         $3.75
1 x Drip Coffee              $3.25

Subtotal:                   $12.50
Tax:                         $1.06
Total:                      $13.56

VISA **** 4242              $13.56
Change:                      $0.00

Thank you for your purchase!
EOF

RUN cat >/home/user/myproject/samples/contract.txt <<'EOF'
SERVICES AGREEMENT

This Services Agreement ("Agreement") is entered into as of April 5, 2024 (the
"Effective Date"), by and between Northwind Technologies, Inc., a Delaware
corporation ("Client"), and Pinewood Consultancy LLP, a California limited
liability partnership ("Consultant").

1. Services. Consultant shall provide professional consulting services to
   Client as described in Exhibit A.
2. Term. This Agreement shall commence on the Effective Date and continue for
   a period of twelve (12) months unless earlier terminated as provided herein.
3. Compensation. Client shall pay Consultant the fees set forth in Exhibit B.
4. Confidentiality. Each party shall protect the other party's Confidential
   Information and shall not disclose it to any third party.
5. Governing Law. This Agreement shall be governed by the laws of the State
   of California, without regard to its conflict-of-laws principles.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the
Effective Date.

CLIENT:                                   CONSULTANT:
Northwind Technologies, Inc.              Pinewood Consultancy LLP

By: ________________________              By: ________________________
Name:  Sarah Patel                        Name:  David Chen
Title: Chief Operating Officer            Title: Managing Partner
EOF

RUN cd /home/user/myproject && npm install --no-audit --no-fund

LABEL Author="generate-harbor-tasks"
LABEL Description="Node.js v24 project with @llamaindex/llama-cloud preinstalled and three sample text documents for LlamaCloud Classify in /home/user/myproject."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (from NodeSource) with npm
#   - /home/user/myproject: Node.js project with package.json, tsconfig.json, and node_modules
#       - dependency: @llamaindex/llama-cloud (TypeScript SDK for LlamaCloud)
#       - dev dependency: tsx (TypeScript runner)
#   - /home/user/myproject/samples/invoice.txt: synthetic invoice text fixture
#   - /home/user/myproject/samples/receipt.txt: synthetic POS receipt text fixture
#   - /home/user/myproject/samples/contract.txt: synthetic legal services agreement fixture
