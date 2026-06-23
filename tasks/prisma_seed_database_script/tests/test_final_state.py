import os
import json
import subprocess

PROJECT_DIR = "/home/user/myproject"
SEED_SCRIPT = os.path.join(PROJECT_DIR, "prisma", "seed.js")
PACKAGE_JSON = os.path.join(PROJECT_DIR, "package.json")

EXPECTED_EMAILS = {"alice@example.com", "bob@example.com", "carol@example.com"}


def test_seed_script_exists():
    # Priority 4 fallback: file existence check — confirmed runtime test below is primary
    assert os.path.isfile(SEED_SCRIPT), f"prisma/seed.js must exist at {SEED_SCRIPT}"


def test_package_json_has_prisma_seed():
    with open(PACKAGE_JSON) as f:
        pkg = json.load(f)
    assert "prisma" in pkg, "package.json must have a 'prisma' key with seed config"
    assert "seed" in pkg["prisma"], "package.json prisma.seed must be defined"


def test_seeded_users_exist_in_db():
    """Priority 1: Query the live DB via Prisma client to verify seed data."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findMany().then(users => { console.log(JSON.stringify(users)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, (
        f"Querying users must succeed; stderr={result.stderr.strip()}"
    )
    users = json.loads(result.stdout.strip())
    assert len(users) == 3, (
        f"Database must contain exactly 3 seeded users; found {len(users)}: {users}"
    )


def test_seeded_user_emails_are_correct():
    """Priority 1: Verify exact email values in the live DB."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findMany().then(users => { console.log(JSON.stringify(users)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    users = json.loads(result.stdout.strip())
    found_emails = {u["email"] for u in users}
    assert found_emails == EXPECTED_EMAILS, (
        f"Expected emails {EXPECTED_EMAILS}; found {found_emails}"
    )


def test_seeded_user_names_are_correct():
    """Priority 1: Verify name values match seed data."""
    result = subprocess.run(
        ["node", "-e",
         "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); "
         "p.user.findMany().then(users => { console.log(JSON.stringify(users)); p.$disconnect(); })"],
        capture_output=True, text=True, cwd=PROJECT_DIR,
    )
    assert result.returncode == 0, f"stderr={result.stderr.strip()}"
    users = json.loads(result.stdout.strip())
    names = {u["name"] for u in users}
    assert names == {"Alice", "Bob", "Carol"}, (
        f"Expected names {{Alice, Bob, Carol}}; found {names}"
    )
