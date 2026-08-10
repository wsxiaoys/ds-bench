#!/usr/bin/env python3
"""
Typesense Visual Filter Chip Builder - Backend Server
"""

import json
import os
from flask import Flask, request, jsonify, send_from_directory
import typesense

app = Flask(__name__, static_folder="static")

TYPESENSE_HOST = "127.0.0.1"
TYPESENSE_PORT = "8108"
TYPESENSE_API_KEY = open("/etc/typesense-api-key").read().strip()
TYPESENSE_PROTOCOL = "http"

COLLECTION_NAME = "products"

VALID_FIELDS = {"id", "name", "category", "brand", "price", "rating", "tags"}
SCALAR_FIELDS = {"id", "name", "category", "brand", "price", "rating"}
ARRAY_FIELDS = {"tags"}
NUMERIC_FIELDS = {"price", "rating"}
STRING_FIELDS = {"id", "name", "category", "brand", "tags"}

client = typesense.Client({
    "nodes": [{
        "host": TYPESENSE_HOST,
        "port": TYPESENSE_PORT,
        "protocol": TYPESENSE_PROTOCOL,
    }],
    "api_key": TYPESENSE_API_KEY,
    "connection_timeout_seconds": 10,
})


def escape_filter_value(value):
    """
    Escape a value for use in a Typesense filter_by expression.
    Uses backtick quoting: `value`
    Handles backticks inside the value by doubling them.
    """
    s = str(value)
    # Double any backticks inside the value
    s = s.replace("`", "``")
    return f"`{s}`"


def is_float(value):
    """Check if a value can be treated as a float."""
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False
    return False


def validate_node(node):
    """
    Validate a filter tree node. Returns (is_valid, error_message).
    """
    if node is None or not isinstance(node, dict):
        return False, "Invalid node: must be an object"

    # Group node
    if "op" in node:
        op = node.get("op")
        if op not in ("and", "or"):
            return False, f"Invalid group operator: {op}"
        children = node.get("children")
        if not isinstance(children, list):
            return False, "Group node 'children' must be an array"
        for child in children:
            valid, err = validate_node(child)
            if not valid:
                return err
        return True, None

    # Condition node
    if "field" in node:
        field = node.get("field")
        if field not in VALID_FIELDS:
            return False, f"Unknown field: {field}"

        cmp = node.get("cmp")
        value = node.get("value")

        valid_comparators = {"eq", "ne", "gt", "gte", "lt", "lte", "between", "in"}

        if cmp not in valid_comparators:
            return False, f"Invalid comparator: {cmp}"

        # Validate value shapes
        if cmp in ("eq", "ne"):
            if not isinstance(value, (str, int, float)):
                return False, f"Comparator '{cmp}' requires a string or number value"
            # For numeric fields, eq/ne value should be numeric
            if field in NUMERIC_FIELDS and not isinstance(value, (int, float)):
                return False, f"Field '{field}' requires a numeric value for '{cmp}'"

        elif cmp in ("gt", "gte", "lt", "lte"):
            if not isinstance(value, (int, float)):
                return False, f"Comparator '{cmp}' requires a numeric value"
            if field not in NUMERIC_FIELDS:
                return False, f"Comparator '{cmp}' can only be used with numeric fields (price, rating)"

        elif cmp == "between":
            if not isinstance(value, list) or len(value) != 2:
                return False, "Comparator 'between' requires a [low, high] array"
            if not all(isinstance(v, (int, float)) for v in value):
                return False, "Comparator 'between' requires numeric bounds"
            if field not in NUMERIC_FIELDS:
                return False, f"Comparator 'between' can only be used with numeric fields (price, rating)"

        elif cmp == "in":
            if not isinstance(value, list):
                return False, "Comparator 'in' requires an array value"

        return True, None

    return False, "Invalid node: must have 'op' (group) or 'field' (condition)"


def build_filter_expression(node):
    """
    Recursively build a Typesense filter_by expression from a filter tree node.
    Returns a string that can be used as the filter_by parameter.
    """
    # Group node
    if "op" in node:
        op = node["op"]
        children = node.get("children", [])

        if len(children) == 0:
            # Empty group: matches everything
            return ""

        parts = []
        for child in children:
            child_expr = build_filter_expression(child)
            if child_expr:
                parts.append(child_expr)

        if len(parts) == 0:
            return ""

        if len(parts) == 1:
            return parts[0]

        joiner = " && " if op == "and" else " || "
        return "(" + f" {joiner} ".join(parts) + ")"

    # Condition node
    field = node["field"]
    cmp = node["cmp"]
    value = node["value"]

    if cmp == "eq":
        if field in NUMERIC_FIELDS:
            return f"{field}:={value}"
        else:
            return f"{field}:={escape_filter_value(value)}"

    elif cmp == "ne":
        if field in NUMERIC_FIELDS:
            return f"{field}:!={value}"
        else:
            return f"{field}:!={escape_filter_value(value)}"

    elif cmp == "gt":
        return f"{field}:>{value}"

    elif cmp == "gte":
        return f"{field}:>={value}"

    elif cmp == "lt":
        return f"{field}:<{value}"

    elif cmp == "lte":
        return f"{field}:<={value}"

    elif cmp == "between":
        low, high = value
        return f"{field}:>={low} && {field}:<={high}"

    elif cmp == "in":
        if field in ARRAY_FIELDS:
            # For array fields, use := to check if array contains any of the values
            conditions = []
            for v in value:
                conditions.append(f"{field}:={escape_filter_value(v)}")
            return "(" + " || ".join(conditions) + ")"
        else:
            # For scalar fields, match if field equals any of the values
            conditions = []
            for v in value:
                if field in NUMERIC_FIELDS:
                    conditions.append(f"{field}:={v}")
                else:
                    conditions.append(f"{field}:={escape_filter_value(v)}")
            return "(" + " || ".join(conditions) + ")"

    return ""


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/filter", methods=["POST"])
def api_filter():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400

    filter_node = data.get("filter")
    if filter_node is None:
        return jsonify({"error": "Missing 'filter' key"}), 400

    # Validate the entire tree
    valid, err = validate_node(filter_node)
    if not valid:
        return jsonify({"error": err}), 400

    # Build the filter expression
    filter_expr = build_filter_expression(filter_node)

    # Query Typesense with pagination to get ALL matching documents
    all_ids = []
    page = 1
    per_page = 250  # Typesense max per_page

    while True:
        search_params = {
            "q": "*",
            "query_by": "name",
            "filter_by": filter_expr if filter_expr else None,
            "per_page": per_page,
            "page": page,
            "include_fields": "id",
        }

        # Remove None values
        search_params = {k: v for k, v in search_params.items() if v is not None}

        try:
            result = client.collections[COLLECTION_NAME].documents.search(search_params)
        except Exception as e:
            return jsonify({"error": f"Typesense search error: {str(e)}"}), 500

        hits = result.get("hits", [])
        for hit in hits:
            doc = hit.get("document", {})
            doc_id = doc.get("id")
            if doc_id:
                all_ids.append(doc_id)

        total = result.get("found", 0)
        if page * per_page >= total:
            break

        page += 1

    return jsonify({
        "ids": all_ids,
        "count": len(all_ids),
    })


def setup_collection():
    """Create the products collection and index data if not already done."""
    try:
        existing = client.collections.retrieve()
    except Exception:
        existing = []

    collection_names = [c.get("name") for c in existing] if isinstance(existing, list) else []

    if COLLECTION_NAME not in collection_names:
        print(f"Creating collection '{COLLECTION_NAME}'...")
        schema = {
            "name": COLLECTION_NAME,
            "fields": [
                {"name": "id", "type": "string"},
                {"name": "name", "type": "string"},
                {"name": "category", "type": "string"},
                {"name": "brand", "type": "string"},
                {"name": "price", "type": "float"},
                {"name": "rating", "type": "float"},
                {"name": "tags", "type": "string[]"},
            ],
        }
        client.collections.create(schema)

        # Index documents
        data_path = os.path.join(os.path.dirname(__file__), "data", "products.jsonl")
        documents = []
        with open(data_path, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    documents.append(json.loads(line))

        print(f"Indexing {len(documents)} documents...")
        # Use import API for batch indexing
        import_results = client.collections[COLLECTION_NAME].documents.import_(
            documents, {"action": "create"}
        )

        # Check for errors
        error_count = 0
        for r in import_results:
            if not r.get("success", True):
                error_count += 1
                print(f"  Import error: {r.get('error', 'unknown')}")

        if error_count:
            print(f"Warning: {error_count} documents failed to import")
        else:
            print(f"Successfully indexed {len(documents)} documents")

    else:
        print(f"Collection '{COLLECTION_NAME}' already exists.")


if __name__ == "__main__":
    setup_collection()
    app.run(host="0.0.0.0", port=8080, debug=False)
