FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf "altair>=5.4" pandas && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Generate the local, self-contained time-series dataset (no network / no remote data).
RUN mkdir -p /home/user/project/data && \
    cat >/tmp/generate_data.py <<'PYEOF'
import csv
import datetime
import math

# Six business categories: (name, base volume, amplitude/trend factor)
categories = [
    ("Retail", 1200, 1.0),
    ("Finance", 900, 0.8),
    ("Healthcare", 700, 0.6),
    ("Technology", 1000, 1.2),
    ("Energy", 600, 0.5),
    ("Transport", 800, 0.7),
]

start = datetime.date(2021, 1, 4)  # a Monday
num_weeks = 156  # ~3 years of weekly observations

rows = []
for week in range(num_weeks):
    day = start + datetime.timedelta(weeks=week)
    for idx, (name, base, factor) in enumerate(categories):
        # Deterministic seasonality (annual cycle) + phase offset per category + trend.
        season = math.sin((week / 52.0) * 2.0 * math.pi + idx)
        trend = week * 2.0 * factor
        volume = int(base + base * 0.4 * factor * season + trend)
        if volume < 50:
            volume = 50
        rows.append((day.isoformat(), name, volume))

with open("/home/user/project/data/category_volume.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["date", "category", "volume"])
    writer.writerows(rows)
PYEOF

RUN python3 /tmp/generate_data.py && rm -f /tmp/generate_data.py

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment with a local weekly category-volume CSV for building a streamgraph exported to HTML."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair (>=5.4) and pandas installed via pip3
#   - /home/user/project: task project directory
#   - /home/user/project/data/category_volume.csv: locally generated weekly time-series dataset
#     (columns: date, category, volume) — no network access or remote datasets required

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
