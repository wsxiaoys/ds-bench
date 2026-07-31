# Build FROM the official Docling CPU image: torch, docling 2.107.0 and ALL default
# model weights are already baked in, so the build performs NO model downloads and the
# container converts documents fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# CentOS 9 Stream base -> dnf, not apt-get. Stay root for the whole image so the
# harness, Pochi CLI, pytest and the agent all have unrestricted access.
USER 0
# MUST reset HOME explicitly: the base image ships HOME=/opt/app-root/src, which would
# otherwise send the Pochi installer to the wrong directory.
ENV HOME=/root

# git, wget and curl are already present in the base image - do not reinstall them.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir \
        pytest pytest-json-ctrf requests \
        fastapi uvicorn starlette python-multipart httpx aiofiles sse-starlette

# Point the docling library at the pre-baked model cache so every conversion is offline.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (agent-authored files must live under /home/user) ---
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user

# --- Build-time input fixtures -------------------------------------------------------
RUN cat >/home/user/project/assets/safety_handbook.html <<'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Field Safety Handbook</title></head>
<body>
<h1>Field Safety Handbook</h1>
<p>This handbook describes the mandatory safety routine for every field technician
operating remote relay stations. It is reviewed twice per year by the operations board
and supersedes all earlier printed editions.</p>

<h2>Incident Response</h2>
<p>Any incident that interrupts service for more than five minutes must be reported to
the duty coordinator before any repair attempt begins. The coordinator opens a ticket,
assigns a severity, and confirms that the affected segment has been isolated.</p>
<p>Technicians must never re-energise a segment while a colleague is still working inside
the enclosure. Confirm verbally, then confirm again with the lockout register.</p>

<h2>Equipment Checklist</h2>
<p>The following equipment must be verified before every shift. Missing or expired items
must be replaced from the depot stock and recorded in the shift log.</p>
<table>
  <thead>
    <tr><th>Item</th><th>Quantity</th><th>Inspection Interval</th></tr>
  </thead>
  <tbody>
    <tr><td>Insulated gloves</td><td>2 pairs</td><td>Monthly</td></tr>
    <tr><td>Voltage detector</td><td>1</td><td>Weekly</td></tr>
    <tr><td>Lockout padlock</td><td>4</td><td>Quarterly</td></tr>
    <tr><td>First aid kit</td><td>1</td><td>Monthly</td></tr>
  </tbody>
</table>

<h2>Escalation Matrix</h2>
<p>Severity one incidents escalate to the regional supervisor within fifteen minutes.
Severity two incidents escalate at the end of the shift. All other findings are collected
in the weekly maintenance digest.</p>
</body>
</html>
HTMLEOF

RUN cat >/home/user/project/assets/release_notes.md <<'MDEOF'
# Release Notes 4.2

The 4.2 maintenance release focuses on ingestion throughput and on the reliability of the
overnight batch window.

## Highlights

- Reduced cold-start latency of the ingestion pool.
- Reworked retry accounting so partial batches are no longer double counted.
- Added a durable audit trail for every rejected document.

## Compatibility

| Component | Previous | Current |
| --- | --- | --- |
| Ingestion schema | 3.9 | 4.2 |
| Audit trail | none | v1 |
| Export bundle | 2.0 | 2.1 |

## Known Issues

Very large spreadsheets may still be split across two audit records when the batch window
closes mid-document. A fix is scheduled for the next maintenance release.
MDEOF

# A deterministic non-document payload with an unknown extension: conversion must fail.
RUN python -c "open('/home/user/project/assets/corrupt_input.xyz','wb').write(bytes(range(256))*24)" \
    && chmod -R 0755 /home/user/project

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling 2.107.0 environment for building a local asynchronous document-conversion gateway service at /home/user/project."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, CPU torch, docling 2.107.0, pre-baked model weights, tesseract)
#   - dnf packages: ripgrep (via EPEL/CRB); git, wget and curl ship with the base image
#   - pip packages: pytest, pytest-json-ctrf, requests (verifier), fastapi, uvicorn,
#     starlette, python-multipart, httpx, aiofiles, sse-starlette (web-service stack,
#     installed at build time so nothing is downloaded at solve or verify time)
#   - Pochi CLI installed to /root/.pochi and symlinked into /usr/local/bin
#   - DOCLING_ARTIFACTS_PATH -> /opt/app-root/src/.cache/docling/models (offline models)
#   - /home/user/project: task project directory (agent authors service/main.py here)
#   - /home/user/project/assets/safety_handbook.html: sectioned HTML fixture with a table
#   - /home/user/project/assets/release_notes.md: Markdown fixture with a table
#   - /home/user/project/assets/corrupt_input.xyz: deterministic unconvertible payload

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
