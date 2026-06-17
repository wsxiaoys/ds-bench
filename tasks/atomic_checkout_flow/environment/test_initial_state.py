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


def test_schema_has_product_and_order():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Product" in content, "schema.prisma must have Product model"
    assert "model Order" in content, "schema.prisma must have Order model"
    assert "stock" in content, "Product must have stock field"


def test_product_has_stock_10():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.product.findUnique({ where: { id: 1 } })"
         ".then(pr => { console.log(pr.stock); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "10", (
        f"Product id=1 must have stock=10; found {result.stdout.strip()}"
    )


def test_checkout_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "checkout.js")), \
        "checkout.js must not exist yet"
