import os
import re
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_schema_has_implicit_m2m():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert re.search(r"\btags\s+Tag\[\]", content), (
        "Post must have implicit 'tags Tag[]' relation"
    )

    assert re.search(r"\bposts\s+Post\[\]", content), (
        "Tag must have implicit 'posts Post[]' relation"
    )


def test_schema_has_no_post_tag_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model PostTag" not in content, "PostTag model must NOT exist yet"


def test_implicit_join_table_has_data():
    result = subprocess.run(
        [
            "node",
            "-e",
            """
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();

    (async () => {
    await p.$queryRaw`SELECT COUNT(*) as cnt FROM _PostToTag`;
    await p.$disconnect();
    })();
    """,
        ],
        capture_output=True,
        text=True,
        cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"_PostToTag implicit join table must be queryable; stderr={result.stderr.strip()}"
    )


def test_migration_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "migrate_m2m.js")), \
        "migrate_m2m.js must not exist yet"
