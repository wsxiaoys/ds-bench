#!/usr/bin/env python3
"""Personalized e-commerce recommender using LanceDB.

Blends a user's recent taste vector (mean of item embeddings from their last
10 interactions) with the current query vector and runs a vector search against
the catalogue, excluding items the user has already seen.
"""

import argparse
import json
import os
import sys

import lancedb
import numpy as np


DB_PATH = "/home/user/project/data"
MAX_HISTORY = 10


def parse_args():
    parser = argparse.ArgumentParser(
        description="Personalized recommender backed by LanceDB."
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="The target user ID string.",
    )
    parser.add_argument(
        "--query-vec",
        required=True,
        help="Path to a .npy file containing the query vector.",
    )
    parser.add_argument(
        "--k",
        type=int,
        required=True,
        help="Number of top recommendation candidates to return.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to the output JSON file where results will be written.",
    )
    return parser.parse_args()


def load_query_vector(path):
    vec = np.load(path)
    # Flatten to a 1-D float32 vector of shape (64,).
    vec = np.asarray(vec, dtype=np.float32).reshape(-1)
    return vec


def get_recent_history(user_history_table, user_id):
    """Return up to MAX_HISTORY most-recent (item_id) for the user, newest first."""
    # Escape single quotes in the user id to keep the where clause valid.
    escaped_uid = user_id.replace("'", "''")
    where_clause = f"user_id = '{escaped_uid}'"

    # Fetch the user's rows (limit generously, then sort by ts in Python so the
    # 10 most recent are deterministic regardless of underlying row order).
    df = (
        user_history_table.search()
        .where(where_clause)
        .limit(10000)
        .to_pandas()
    )
    if df.empty:
        return []

    df = df.sort_values("ts", ascending=False)
    recent = df.head(MAX_HISTORY)
    return recent["item_id"].astype(int).tolist()


def get_item_embeddings(items_table, item_ids):
    """Retrieve the embedding vectors for the given item ids."""
    if not item_ids:
        return np.zeros((0,), dtype=np.float32)

    ids_str = ", ".join(str(int(i)) for i in item_ids)
    where_clause = f"id IN ({ids_str})"

    df = items_table.search().where(where_clause).limit(len(item_ids)).to_pandas()
    if df.empty:
        return np.zeros((0,), dtype=np.float32)

    vectors = np.stack(df["vector"].values).astype(np.float32)
    return vectors


def compute_taste_vector(vectors):
    """Mean of the provided item embedding vectors."""
    if vectors.shape[0] == 0:
        return None
    return vectors.mean(axis=0).astype(np.float32)


def blend_vectors(query_vec, taste_vec, alpha):
    """Blended vector = (1 - alpha) * query + alpha * taste.

    Falls back to the pure query vector when there is no taste vector.
    """
    if taste_vec is None:
        return query_vec.astype(np.float32)
    blended = (1.0 - alpha) * query_vec + alpha * taste_vec
    return blended.astype(np.float32)


def build_exclusion_clause(seen_ids):
    """Build a SQL `NOT IN (...)` predicate for already-seen item ids."""
    if not seen_ids:
        return None
    ids_str = ", ".join(str(int(i)) for i in seen_ids)
    return f"id NOT IN ({ids_str})"


def search_items(items_table, query_vec, where_clause, k):
    """Run a vector search on the items table, optionally filtered."""
    search_builder = items_table.search(query_vec.tolist())
    if where_clause is not None:
        search_builder = search_builder.where(where_clause)
    df = search_builder.limit(k).to_pandas()
    if df.empty:
        return []
    return df["id"].astype(int).tolist()


def main():
    args = parse_args()
    alpha = float(os.environ.get("BLEND_ALPHA", "0.3"))

    # Load the query vector.
    query_vec = load_query_vector(args.query_vec)

    # Connect to LanceDB and open the tables (do not recreate/modify them).
    db = lancedb.connect(DB_PATH)
    items_table = db.open_table("items")
    user_history_table = db.open_table("user_history")

    # 1. Load up to the 10 most recent interactions for the user.
    seen_ids = get_recent_history(user_history_table, args.user_id)

    # 2. Retrieve embeddings for those interacted items and compute the taste vector.
    item_vectors = get_item_embeddings(items_table, seen_ids)
    taste_vec = compute_taste_vector(item_vectors)

    # 3. Blend the taste vector with the current query vector.
    blended_vec = blend_vectors(query_vec, taste_vec, alpha)

    # 4. Build the exclusion clause for already-seen items.
    where_clause = build_exclusion_clause(seen_ids)

    # 5. Run vector search against the items table for the top-k candidates.
    top_ids = search_items(items_table, blended_vec, where_clause, args.k)

    # 6. Write the top-k item ids (in rank order) as a JSON array of integers.
    with open(args.output, "w") as f:
        json.dump([int(i) for i in top_ids], f)

    print(
        f"User '{args.user_id}': {len(seen_ids)} recent interactions, "
        f"alpha={alpha}, returning {len(top_ids)} recommendations -> {args.output}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()