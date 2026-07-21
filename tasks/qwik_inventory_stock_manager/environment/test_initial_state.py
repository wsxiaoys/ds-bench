import json
import os
import shutil
import sqlite3

import pytest

PROJECT_DIR = "/home/user/inventory-app"
DB_PATH = "/home/user/inventory-app/data/inventory.db"

EXPECTED_STOCK = {1: 100, 2: 50, 3: 10, 4: 60}
EXPECTED_SKUS = {1: "WIDGET-A", 2: "GADGET-B", 3: "GIZMO-C", 4: "BOLT-D"}


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_declares_qwik():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"package.json not found at {pkg_path}."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    deps.update(pkg.get("dependencies", {}))
    deps.update(pkg.get("devDependencies", {}))
    assert "@builder.io/qwik" in deps, "@builder.io/qwik is not a declared dependency."
    assert "@builder.io/qwik-city" in deps, "@builder.io/qwik-city is not a declared dependency."


def test_dependencies_installed():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    assert os.path.isdir(node_modules), "node_modules is missing; dependencies are not installed."
    assert os.path.isdir(
        os.path.join(node_modules, "@builder.io", "qwik-city")
    ), "@builder.io/qwik-city is not installed in node_modules."
    assert os.path.isdir(
        os.path.join(node_modules, "better-sqlite3")
    ), "better-sqlite3 is not installed in node_modules."


def test_database_file_exists():
    assert os.path.isfile(DB_PATH), f"SQLite database {DB_PATH} does not exist."


def test_database_schema_present():
    conn = sqlite3.connect(DB_PATH)
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
    finally:
        conn.close()
    assert "products" in tables, "products table is missing from the seeded database."
    assert "stock_movements" in tables, "stock_movements table is missing from the seeded database."


def test_products_seeded():
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute("SELECT id, sku FROM products ORDER BY id").fetchall()
    finally:
        conn.close()
    actual = {row[0]: row[1] for row in rows}
    assert actual == EXPECTED_SKUS, f"Seeded products {actual} do not match expected {EXPECTED_SKUS}."


def test_initial_stock_from_ledger():
    conn = sqlite3.connect(DB_PATH)
    try:
        rows = conn.execute(
            "SELECT product_id, SUM(delta) FROM stock_movements GROUP BY product_id"
        ).fetchall()
    finally:
        conn.close()
    actual = {row[0]: row[1] for row in rows}
    assert actual == EXPECTED_STOCK, (
        f"Initial on-hand stock computed from the ledger {actual} does not match expected {EXPECTED_STOCK}."
    )
