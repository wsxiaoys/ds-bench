FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "llama-cloud>=2.7" \
        httpx \
        pandas \
        pyarrow \
        openpyxl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project/data /home/user/project/output

# Seed the sample spreadsheet that the task will parse with LlamaSheets.
# It contains a small "Sales" table in A1:D6 plus an unrelated note further
# down the sheet, mimicking the messy spreadsheets LlamaSheets is designed
# to normalize.
RUN python3 - <<'PYEOF'
from openpyxl import Workbook

wb = Workbook()
ws = wb.active
ws.title = "Sales"

rows = [
    ["Month", "Units", "Revenue", "Region"],
    ["Jan",     12, 1200, "North"],
    ["Feb",     15, 1500, "North"],
    ["Mar",     18, 1800, "South"],
    ["Apr",     21, 2100, "South"],
    ["May",     24, 2400, "West"],
]
for r_idx, row in enumerate(rows, start=1):
    for c_idx, value in enumerate(row, start=1):
        ws.cell(row=r_idx, column=c_idx, value=value)

# Unrelated trailing note (well below the main table) so LlamaSheets must
# isolate the actual tabular region rather than returning the entire sheet.
ws.cell(row=10, column=1, value="Note: figures are illustrative only.")

wb.save("/home/user/project/data/sales.xlsx")
PYEOF

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud LlamaSheets (beta) task environment: Python 3 + llama-cloud SDK v2 + a seeded sample XLSX for region extraction."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud (>=2.7) Python SDK v2 for the LlamaSheets task
#   - httpx (for downloading the result Parquet URL returned by the API)
#   - pandas + pyarrow (verifier reads the downloaded Parquet artifacts)
#   - openpyxl (used during build to author the seeded sample workbook)
#   - /home/user/project/data/sales.xlsx: seeded sample workbook (Sales table A1:D6 + trailing note)
#   - /home/user/project/output: empty directory where the executor writes sheets.log and region_*.parquet
