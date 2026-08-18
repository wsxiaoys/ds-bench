# Build FROM the official Docling CPU image: torch, docling and ALL default model
# weights are already baked in, so the build performs no downloads and the whole
# task runs fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest and
# the agent all have unrestricted access. HOME must be reset explicitly.
USER 0
ENV HOME=/root
# NOTE: git, wget and curl already ship with the base image.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && ln -s /root/.local/bin/uv /usr/local/bin/uv \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf

# --- Runtime configuration ---
# Point the docling library at the pre-baked model cache so nothing is fetched.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (must live under /home/user) ---
RUN mkdir -p /home/user/project/assets/inbox && chmod -R 0755 /home/user

# --- Build-time input fixtures: a drop directory of candidate Docling JSON files ---
RUN cat >/tmp/gen_fixtures.py <<'PYEOF'
import json
from pathlib import Path

from docling_core.types.doc import (
    BoundingBox,
    CoordOrigin,
    DocItemLabel,
    DoclingDocument,
    ProvenanceItem,
    Size,
    TableCell,
    TableData,
)

INBOX = Path("/home/user/project/assets/inbox")
INBOX.mkdir(parents=True, exist_ok=True)


def dump(payload) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


# --- alpha_report.json: a rich, valid Docling document ---
alpha = DoclingDocument(name="alpha_report")
alpha.add_page(page_no=1, size=Size(width=612.0, height=792.0))
alpha.add_title(text="Quarterly Report")
section = alpha.add_heading(text="Revenue", level=1)
alpha.add_text(
    label=DocItemLabel.TEXT,
    text="Revenue grew by 12% year over year across all reporting regions.",
    parent=section,
    prov=ProvenanceItem(
        page_no=1,
        bbox=BoundingBox(
            l=72.0, t=700.0, r=540.0, b=680.0, coord_origin=CoordOrigin.BOTTOMLEFT
        ),
        charspan=(0, 63),
    ),
)
rows = [
    ["Region", "Q1", "Q2"],
    ["EMEA", "10", "12"],
    ["APAC", "7", "9"],
]
cells = []
for row_idx, row in enumerate(rows):
    for col_idx, value in enumerate(row):
        cells.append(
            TableCell(
                text=value,
                row_span=1,
                col_span=1,
                start_row_offset_idx=row_idx,
                end_row_offset_idx=row_idx + 1,
                start_col_offset_idx=col_idx,
                end_col_offset_idx=col_idx + 1,
                column_header=(row_idx == 0),
            )
        )
alpha.add_table(
    data=TableData(num_rows=3, num_cols=3, table_cells=cells),
    caption=alpha.add_text(label=DocItemLabel.CAPTION, text="Revenue by region"),
)
alpha.add_picture(
    caption=alpha.add_text(label=DocItemLabel.CAPTION, text="Figure 1: revenue trend")
)
highlights = alpha.add_group(name="highlights")
alpha.add_list_item(text="EMEA revenue up 20%", parent=highlights)
alpha.add_list_item(text="APAC revenue up 28%", parent=highlights)

alpha_payload = alpha.export_to_dict()
alpha_text = dump(alpha_payload)
(INBOX / "alpha_report.json").write_text(alpha_text, encoding="utf-8")

# --- beta_notes.json: a valid document carrying non-ASCII content ---
beta = DoclingDocument(name="beta_notes")
beta.add_title(text="Résumé des notes")
beta.add_text(label=DocItemLabel.TEXT, text="净收入 → 12.5% (année sur année)")
beta.add_text(
    label=DocItemLabel.TEXT, text="Résumé complet de la réunion trimestrielle."
)
beta_payload = beta.export_to_dict()
beta_text = dump(beta_payload)
(INBOX / "beta_notes.json").write_text(beta_text, encoding="utf-8")

# --- gamma_legacy.json: beta with an older, still compatible schema version ---
gamma_payload = json.loads(beta_text)
gamma_payload["version"] = "1.0.0"
(INBOX / "gamma_legacy.json").write_text(dump(gamma_payload), encoding="utf-8")

# --- delta_truncated.json: the first 400 bytes of alpha (broken JSON) ---
(INBOX / "delta_truncated.json").write_bytes(alpha_text.encode("utf-8")[:400])

# --- epsilon_empty_object.json: an empty JSON object ---
(INBOX / "epsilon_empty_object.json").write_bytes(b"{}")

# --- zeta_array.json: a top-level JSON array ---
(INBOX / "zeta_array.json").write_text(
    dump([{"schema_name": "DoclingDocument"}]), encoding="utf-8"
)

# --- eta_future_version.json: alpha with an incompatible schema version ---
eta_payload = json.loads(alpha_text)
eta_payload["version"] = "99.0.0"
(INBOX / "eta_future_version.json").write_text(dump(eta_payload), encoding="utf-8")

# --- theta_bad_types.json: alpha with a structurally invalid member ---
theta_payload = json.loads(alpha_text)
theta_payload["texts"] = "not-a-list"
(INBOX / "theta_bad_types.json").write_text(dump(theta_payload), encoding="utf-8")

# --- readme.txt: a non-candidate file that must be ignored ---
(INBOX / "readme.txt").write_text(
    "Drop directory for exported Docling JSON documents.\n", encoding="utf-8"
)
PYEOF

RUN python /tmp/gen_fixtures.py && rm -f /tmp/gen_fixtures.py

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling (docling-slim 2.115.0 / docling-core 2.87.1) environment with a drop directory of valid, corrupted and version-mismatched DoclingDocument JSON fixtures at /home/user/project/assets/inbox."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, docling-slim 2.115.0, docling-core 2.87.1, pre-baked model cache)
#   - dnf packages: ripgrep (git/wget/curl already present in the base image)
#   - pip packages: pytest, pytest-json-ctrf
#   - Pochi CLI at /usr/local/bin/pochi, uv at /usr/local/bin/uv
#   - /home/user/project: Harbor project directory (WORKDIR)
#   - /home/user/project/assets/inbox: nine build-time fixtures (three ingestable
#     documents, one legacy-version document, one truncated file, one empty object,
#     one JSON array, one future-version document, one type-invalid document, plus
#     a readme.txt that must be ignored)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
