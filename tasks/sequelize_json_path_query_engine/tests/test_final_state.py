import json
import os
import subprocess

import pytest

PROJECT_DIR = "/home/user/project"

# Seed dataset. Products are inserted in this exact order, so they receive
# ids 1..5 respectively.
SEED = [
    {"name": "Alpha", "attributes": {"specs": {"ram": 8, "cpu": "i5", "storageGB": 256}, "tags": ["office", "laptop"], "price": 600}},
    {"name": "Bravo", "attributes": {"specs": {"ram": 16, "cpu": "i7", "storageGB": 512}, "tags": ["gaming", "laptop"], "price": 1200}},
    {"name": "Charlie", "attributes": {"specs": {"ram": 128, "cpu": "i9", "storageGB": 2048}, "tags": ["gaming", "workstation"], "price": 4000}},
    {"name": "Delta", "attributes": {"specs": {"ram": 32, "cpu": "i7", "storageGB": 1024}, "tags": ["progaming", "laptop"], "price": 1800}},
    {"name": "Echo gaming edition", "attributes": {"specs": {"ram": 12, "cpu": "i5", "storageGB": 256}, "tags": ["office"], "price": 700}},
]


def run_cli(args, env=None, timeout=90):
    """Run `node cli.js <args>` inside the project directory."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    return subprocess.run(
        ["node", "cli.js", *args],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=full_env,
        timeout=timeout,
    )


@pytest.fixture(scope="session", autouse=True)
def ensure_deps():
    """Ensure node dependencies are installed before running the CLI."""
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    cli_path = os.path.join(PROJECT_DIR, "cli.js")
    assert os.path.isfile(cli_path), f"Expected CLI entrypoint at {cli_path}."
    if not os.path.isdir(node_modules):
        result = subprocess.run(
            ["npm", "install"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=600,
        )
        assert result.returncode == 0, f"'npm install' failed: {result.stdout}\n{result.stderr}"


@pytest.fixture()
def db(tmp_path):
    """Provide a freshly seeded, isolated SQLite database for each test."""
    db_path = str(tmp_path / "verify.sqlite")
    seed_path = str(tmp_path / "seed.json")
    with open(seed_path, "w") as f:
        json.dump(SEED, f)
    result = run_cli(["load", "--db", db_path, "--file", seed_path])
    assert result.returncode == 0, f"'load' command failed: {result.stdout}\n{result.stderr}"
    return db_path


def parse_products(result):
    assert result.returncode == 0, f"CLI command failed: {result.stdout}\n{result.stderr}"
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(f"CLI stdout was not valid JSON: {result.stdout!r} ({exc})")
    assert isinstance(data, list), f"Expected a JSON array, got: {type(data).__name__}"
    return data


def ids_of(products):
    return [p["id"] for p in products]


def test_filter_num_gte_numeric_semantics(db):
    """attributes.specs.ram >= 16 must use numeric (not lexicographic) comparison."""
    result = run_cli(["filter-num", "--db", db, "--path", "specs.ram", "--op", "gte", "--value", "16"])
    products = parse_products(result)
    assert ids_of(products) == [2, 3, 4], (
        f"Expected ids [2, 3, 4] (Bravo=16, Charlie=128, Delta=32) in ascending order, got {ids_of(products)}. "
        "A lexicographic comparison would wrongly drop Charlie (128)."
    )


def test_filter_num_strict_gt(db):
    result = run_cli(["filter-num", "--db", db, "--path", "specs.ram", "--op", "gt", "--value", "16"])
    products = parse_products(result)
    assert ids_of(products) == [3, 4], (
        f"Expected ids [3, 4] for specs.ram > 16 (Bravo=16 excluded), got {ids_of(products)}."
    )


def test_filter_str_equality(db):
    result = run_cli(["filter-str", "--db", db, "--path", "specs.cpu", "--value", "i7"])
    products = parse_products(result)
    assert ids_of(products) == [2, 4], (
        f"Expected ids [2, 4] for specs.cpu == 'i7', got {ids_of(products)}."
    )


def test_filter_str_empty_result(db):
    result = run_cli(["filter-str", "--db", db, "--path", "specs.cpu", "--value", "i11"])
    products = parse_products(result)
    assert products == [], f"Expected an empty array for a non-matching filter, got {products}."


def test_filter_tag_exact_membership(db):
    """Membership must be an exact array element, not a substring or a value elsewhere."""
    result = run_cli(["filter-tag", "--db", db, "--path", "tags", "--value", "gaming"])
    products = parse_products(result)
    assert ids_of(products) == [2, 3], (
        f"Expected ids [2, 3] for 'gaming' in tags, got {ids_of(products)}. "
        "Delta (tag 'progaming') and Echo (name contains 'gaming' but tag is 'office') must NOT match."
    )


def test_product_object_shape(db):
    result = run_cli(["filter-num", "--db", db, "--path", "specs.ram", "--op", "gte", "--value", "0"])
    products = parse_products(result)
    assert len(products) == 5, f"Expected all 5 products, got {len(products)}."
    for p in products:
        assert set(p.keys()) == {"id", "name", "attributes"}, (
            f"Each product must have exactly keys id, name, attributes; got {sorted(p.keys())}."
        )
        assert isinstance(p["id"], int), f"'id' must be a number, got {type(p['id']).__name__}."
        assert isinstance(p["name"], str), f"'name' must be a string, got {type(p['name']).__name__}."
        assert isinstance(p["attributes"], dict), (
            f"'attributes' must be the parsed nested object (dict), got {type(p['attributes']).__name__}."
        )


def test_set_key_numeric_preserves_siblings(db):
    result = run_cli(["set-key", "--db", db, "--id", "2", "--path", "specs.ram", "--json", "64"])
    products = parse_products_single(result)
    attrs = products["attributes"]
    assert products["id"] == 2, f"Expected updated product id 2, got {products['id']}."
    assert attrs["specs"]["ram"] == 64, f"Expected specs.ram == 64, got {attrs['specs'].get('ram')}."
    assert attrs["specs"]["cpu"] == "i7", f"Sibling specs.cpu was clobbered: {attrs['specs'].get('cpu')}."
    assert attrs["specs"]["storageGB"] == 512, f"Sibling specs.storageGB was clobbered: {attrs['specs'].get('storageGB')}."
    assert attrs["tags"] == ["gaming", "laptop"], f"Sibling tags was clobbered: {attrs.get('tags')}."
    assert attrs["price"] == 1200, f"Sibling price was clobbered: {attrs.get('price')}."

    # Confirm the change was persisted and did not corrupt the rest of the table.
    result2 = run_cli(["filter-str", "--db", db, "--path", "specs.cpu", "--value", "i7"])
    assert ids_of(parse_products(result2)) == [2, 4], "specs.cpu index broke after the nested update."


def test_set_key_string_value_preserves_siblings(db):
    result = run_cli(["set-key", "--db", db, "--id", "3", "--path", "specs.cpu", "--json", '"i3"'])
    product = parse_products_single(result)
    attrs = product["attributes"]
    assert product["id"] == 3, f"Expected updated product id 3, got {product['id']}."
    assert attrs["specs"]["cpu"] == "i3", f"Expected specs.cpu == 'i3', got {attrs['specs'].get('cpu')}."
    assert attrs["specs"]["ram"] == 128, f"Sibling specs.ram was clobbered: {attrs['specs'].get('ram')}."
    assert attrs["specs"]["storageGB"] == 2048, f"Sibling specs.storageGB was clobbered: {attrs['specs'].get('storageGB')}."


def test_set_key_missing_id_errors(db):
    result = run_cli(["set-key", "--db", db, "--id", "999", "--path", "specs.ram", "--json", "8"])
    assert result.returncode != 0, (
        f"Expected a non-zero exit status when updating a non-existent id, got {result.returncode}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    assert result.stderr.strip() != "", "Expected an error message on stderr for a missing id."


def _assert_pushed_to_sql(log_path):
    assert os.path.isfile(log_path), f"SQL_LOG file {log_path} was not created."
    with open(log_path) as f:
        lines = [ln.strip() for ln in f.readlines() if ln.strip()]
    content_lower = "\n".join(lines).lower()
    assert "json" in content_lower, (
        f"Recorded SQL does not reference any JSON function (json_extract/json_each). Log:\n{content_lower}"
    )
    # Every SELECT that reads the JSON `attributes` column must be constrained by a
    # WHERE clause that uses a JSON function. A select-all-then-filter-in-JS
    # implementation would emit a SELECT of `attributes` with no WHERE clause.
    select_attr_lines = [
        ln.lower() for ln in lines
        if ln.lower().startswith("select") and "attributes" in ln.lower()
    ]
    assert select_attr_lines, (
        f"No SELECT statement referencing the 'attributes' column was recorded. Log:\n{content_lower}"
    )
    for ln in select_attr_lines:
        assert "where" in ln, (
            f"Found a SELECT over 'attributes' with no WHERE clause (in-memory filtering). Statement:\n{ln}"
        )
        assert "json" in ln, (
            f"The filtering SELECT does not use a JSON function against the JSON column. Statement:\n{ln}"
        )


def test_filter_num_pushed_to_sql(db, tmp_path):
    log_path = str(tmp_path / "sql_num.log")
    result = run_cli(
        ["filter-num", "--db", db, "--path", "specs.ram", "--op", "gte", "--value", "16"],
        env={"SQL_LOG": log_path},
    )
    assert ids_of(parse_products(result)) == [2, 3, 4], "filter-num returned wrong results while logging SQL."
    _assert_pushed_to_sql(log_path)


def test_filter_tag_pushed_to_sql(db, tmp_path):
    log_path = str(tmp_path / "sql_tag.log")
    result = run_cli(
        ["filter-tag", "--db", db, "--path", "tags", "--value", "gaming"],
        env={"SQL_LOG": log_path},
    )
    assert ids_of(parse_products(result)) == [2, 3], "filter-tag returned wrong results while logging SQL."
    _assert_pushed_to_sql(log_path)


def parse_products_single(result):
    assert result.returncode == 0, f"CLI command failed: {result.stdout}\n{result.stderr}"
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(f"CLI stdout was not valid JSON: {result.stdout!r} ({exc})")
    assert isinstance(data, dict), f"Expected a single JSON object, got: {type(data).__name__}"
    assert set(data.keys()) == {"id", "name", "attributes"}, (
        f"Updated product must have exactly keys id, name, attributes; got {sorted(data.keys())}."
    )
    return data
