import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
RESULT_FILE = os.path.join(PROJECT_DIR, "checkout_result.json")


def test_checkout_script_runs():
    """Priority 1: Execute the agent's script."""
    result = subprocess.run(
        ["node", "checkout.js"], capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"node checkout.js must exit 0; stderr={result.stderr.strip()}"


def test_result_file_exists():
    assert os.path.isfile(RESULT_FILE), f"checkout_result.json must exist at {RESULT_FILE}"


def test_final_stock_is_seven():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("finalStock") == 7, (
        f"finalStock must be 7 (10-3); got: {data.get('finalStock')}"
    )


def test_order_count_is_one():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("orderCount") == 1, (
        f"orderCount must be 1 (only successful checkout); got: {data.get('orderCount')}"
    )


def test_insufficient_stock_caught():
    with open(RESULT_FILE) as f:
        data = json.load(f)
    assert data.get("insufficientStockCaught") is True, (
        "insufficientStockCaught must be true"
    )


def test_db_product_stock():
    """Priority 1: Confirm via live DB query."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.product.findUnique({ where: { id: 1 } })"
         ".then(pr => { console.log(pr.stock); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    assert result.stdout.strip() == "7", (
        f"DB product stock must be 7; got: {result.stdout.strip()}"
    )
