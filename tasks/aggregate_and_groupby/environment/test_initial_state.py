import os
import shutil
import subprocess
import json

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_order_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Order" in content, "schema.prisma must have Order model"
    assert "amount" in content, "Order model must have amount field"
    assert "status" in content, "Order model must have status field"


def test_db_has_six_orders():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.order.count().then(n => { console.log(n); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "6", (
        f"DB must have exactly 6 orders; found {result.stdout.strip()}"
    )


def test_aggregate_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "aggregate.js")), \
        "aggregate.js must not exist yet"
