import os
import subprocess

PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "prisma", "schema.prisma")


def test_schema_has_post_model():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "model Post" in content, "schema.prisma must contain 'model Post' after the task"


def test_post_model_has_title_field():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "title" in content, "Post model must define a 'title' field"


def test_post_model_has_author_relation():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "authorId" in content, "Post model must have an 'authorId' foreign key field"
    assert "@relation" in content, "Post model must have an @relation annotation linking to User"


def test_user_model_has_posts_back_relation():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    assert "posts" in content and "Post[]" in content, (
        "User model must have a 'posts Post[]' back-relation field"
    )


def test_prisma_client_exposes_post_model():
    """Priority 1: Run node to verify generated client exposes prisma.post as object."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.post);"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"node command must exit 0; stderr={result.stderr.strip()}"
    )
    assert "object" in result.stdout, (
        f"prisma.post must be 'object' after prisma generate; got: {result.stdout.strip()}"
    )


def test_prisma_generate_produces_no_errors():
    """Priority 1: Re-run prisma generate to confirm schema is valid and generates cleanly."""
    result = subprocess.run(
        ["npx", "prisma", "generate"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"npx prisma generate must succeed; stderr={result.stderr.strip()}"
    )
