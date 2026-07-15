FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "altair==5.5.0" \
        "vl-convert-python==1.7.0" \
        pandas \
        numpy && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Generate the deterministic local daily stock price dataset (no network / remote URLs).
RUN mkdir -p /home/user/altair-stocks && python3 <<'PYEOF'
import csv

import numpy as np
import pandas as pd

rng = np.random.default_rng(20240115)
dates = pd.bdate_range("2022-01-03", "2023-12-29")
symbols = {"AAPL": 170.0, "GOOG": 140.0, "MSFT": 300.0}

rows = []
for sym, start in symbols.items():
    price = start
    drift = float(rng.uniform(-0.02, 0.05))
    for d in dates:
        shock = float(rng.normal(0.0, 1.0)) * (start * 0.01)
        price = max(1.0, price + shock + drift)
        rows.append((d.strftime("%Y-%m-%d"), sym, round(price, 2)))

with open("/home/user/altair-stocks/stocks.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["date", "symbol", "price"])
    writer.writerows(rows)

print(f"Wrote {len(rows)} rows to /home/user/altair-stocks/stocks.csv")
PYEOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair environment with a local daily stock price CSV for building a layered rolling-window HTML chart."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair==5.5.0 (Vega-Altair) plus vl-convert-python for offline HTML export, pandas, numpy
#   - /home/user/altair-stocks: project directory
#   - /home/user/altair-stocks/stocks.csv: deterministic local daily stock prices (AAPL, GOOG, MSFT), no remote data

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
