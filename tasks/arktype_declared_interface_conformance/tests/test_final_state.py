import os
import re
import subprocess


PROJECT_DIR = "/home/user/myproject"
SCHEMA_PATH = os.path.join(PROJECT_DIR, "schema.ts")
BROKEN_PATH = os.path.join(PROJECT_DIR, "broken.ts")
TYPES_PATH = os.path.join(PROJECT_DIR, "types.ts")


def _strip_ts_comments(source: str) -> str:
    """Remove // line comments and /* */ block comments from TypeScript source."""
    no_block = re.sub(r"/\*.*?\*/", "", source, flags=re.DOTALL)
    no_line = re.sub(r"//[^\n]*", "", no_block)
    return no_line


def test_types_ts_product_interface_unchanged():
    assert os.path.isfile(TYPES_PATH), f"{TYPES_PATH} does not exist."
    with open(TYPES_PATH) as f:
        content = f.read()
    assert "interface Product" in content, "Expected `interface Product` declaration in types.ts."
    for prop in ("id", "sku", "price", "tags"):
        assert prop in content, f"Expected `{prop}` to remain declared on the Product interface."


def test_schema_ts_exists():
    assert os.path.isfile(SCHEMA_PATH), f"{SCHEMA_PATH} does not exist."


def test_schema_ts_uses_exact_declare_call_form():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    cleaned = _strip_ts_comments(content)
    cleaned_compact = re.sub(r"\s+", "", cleaned)
    assert "type.declare<Product>()(" in cleaned_compact, (
        "Expected schema.ts to use the exact call form `type.declare<Product>()({...})`."
    )


def test_schema_ts_imports_product_from_types():
    with open(SCHEMA_PATH) as f:
        content = f.read()
    cleaned = _strip_ts_comments(content)
    pattern = re.compile(
        r"import\s*(?:type\s*)?\{[^}]*\bProduct\b[^}]*\}\s*from\s*['\"]\./types(?:\.[jt]s)?['\"]"
    )
    assert pattern.search(cleaned), (
        "Expected schema.ts to import `Product` from './types' (or './types.ts'/'./types.js')."
    )


def test_broken_ts_exists():
    assert os.path.isfile(BROKEN_PATH), f"{BROKEN_PATH} does not exist."


def test_broken_ts_uses_exact_declare_call_form():
    with open(BROKEN_PATH) as f:
        content = f.read()
    cleaned = _strip_ts_comments(content)
    cleaned_compact = re.sub(r"\s+", "", cleaned)
    assert "type.declare<Product>()(" in cleaned_compact, (
        "Expected broken.ts to use the exact call form `type.declare<Product>()({...})`."
    )


def test_broken_ts_omits_tags_key():
    with open(BROKEN_PATH) as f:
        content = f.read()
    cleaned = _strip_ts_comments(content)
    # Find the object literal passed into the declare call.
    match = re.search(
        r"type\.declare\s*<\s*Product\s*>\s*\(\s*\)\s*\(\s*(\{.*?\})\s*\)",
        cleaned,
        flags=re.DOTALL,
    )
    assert match is not None, (
        "Could not locate the `type.declare<Product>()({...})` object literal in broken.ts."
    )
    literal = match.group(1)
    assert "tags" not in literal, (
        "broken.ts must intentionally omit the `tags` property from the declared schema literal."
    )


def test_runtime_validation_succeeds():
    """`npm run validate` must succeed and print a `Validated product: <id>` line."""
    result = subprocess.run(
        ["npm", "run", "validate", "--silent"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Expected `npm run validate` to succeed. exit={result.returncode}, "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}."
    )
    combined = result.stdout + "\n" + result.stderr
    assert re.search(r"Validated product:\s*\S+", combined), (
        f"Expected stdout to contain a line of the form `Validated product: <id>`. "
        f"Got stdout={result.stdout!r}, stderr={result.stderr!r}."
    )


def test_runtime_independent_verification():
    """Independently import the agent's `productSchema` default export via tsx and verify it
    accepts a valid Product payload and rejects an invalid (tags-less) payload using ArkType."""
    helper_src = (
        "import productSchema from \"./schema.ts\";\n"
        "import { type } from \"arktype\";\n"
        "const valid = { id: \"prod-001\", sku: \"SKU-AAA-001\", price: 19.99, tags: [\"new\", \"featured\"] };\n"
        "const okResult = (productSchema as any)(valid);\n"
        "if (okResult instanceof type.errors) {\n"
        "  console.error(\"FAIL: valid payload was rejected:\", okResult.summary);\n"
        "  process.exit(2);\n"
        "}\n"
        "const invalid = { id: \"prod-002\", sku: \"SKU-AAA-002\", price: 9.99 };\n"
        "const badResult = (productSchema as any)(invalid);\n"
        "if (!(badResult instanceof type.errors)) {\n"
        "  console.error(\"FAIL: invalid payload (missing tags) was accepted\");\n"
        "  process.exit(3);\n"
        "}\n"
        "console.log(\"INDEPENDENT_OK\");\n"
    )
    helper_path = os.path.join(PROJECT_DIR, "_zealt_runtime_check.ts")
    try:
        with open(helper_path, "w") as f:
            f.write(helper_src)
        result = subprocess.run(
            ["npx", "--no-install", "tsx", "_zealt_runtime_check.ts"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
        )
    finally:
        if os.path.exists(helper_path):
            os.remove(helper_path)
    assert result.returncode == 0, (
        f"Independent runtime verification failed. exit={result.returncode}, "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}."
    )
    assert "INDEPENDENT_OK" in result.stdout, (
        f"Expected independent check stdout to contain `INDEPENDENT_OK`. "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}."
    )


def test_project_typechecks():
    """`npx tsc --noEmit` over the project must succeed."""
    result = subprocess.run(
        ["npx", "--no-install", "tsc", "--noEmit"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Expected `npx tsc --noEmit` to succeed in {PROJECT_DIR}. "
        f"exit={result.returncode}, stdout={result.stdout!r}, stderr={result.stderr!r}."
    )


def test_broken_ts_fails_typecheck():
    """`tsc --noEmit broken.ts` must fail with a TS error referencing the missing `tags` property."""
    result = subprocess.run(
        [
            "npx",
            "--no-install",
            "tsc",
            "--noEmit",
            "--strict",
            "--target",
            "ES2022",
            "--module",
            "ESNext",
            "--moduleResolution",
            "Bundler",
            "--esModuleInterop",
            "--skipLibCheck",
            "broken.ts",
        ],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0, (
        f"Expected `tsc --noEmit broken.ts` to FAIL with a type error, but it succeeded. "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}."
    )
    combined = (result.stdout + "\n" + result.stderr).lower()
    assert "tags" in combined, (
        f"Expected the TypeScript error output to mention the missing `tags` property. "
        f"stdout={result.stdout!r}, stderr={result.stderr!r}."
    )
