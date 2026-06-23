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


def test_schema_has_document_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Document" in content, "schema.prisma must have Document model"
    assert "version" in content, "Document must have version field"


def test_document_initial_state():
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.document.findUnique({ where: { id: 1 } })"
         ".then(d => { console.log(JSON.stringify(d)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    doc = json.loads(result.stdout.strip())
    assert doc is not None, "Document id=1 must exist"
    assert doc.get("version") == 1, f"Document must start with version=1; got {doc.get('version')}"
    assert doc.get("content") == "Draft", f"Document content must be 'Draft'; got {doc.get('content')}"


def test_optimistic_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "optimistic.js")), \
        "optimistic.js must not exist yet"
