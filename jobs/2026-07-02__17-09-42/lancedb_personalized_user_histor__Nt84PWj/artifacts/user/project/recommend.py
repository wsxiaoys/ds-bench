#!/usr/bin/env python3
"""Personalized user-history recommender backed by LanceDB.

Blends a user's recent taste (mean of their most recently interacted item
embeddings) with a current query vector and runs a vector search against the
catalogue, excluding items the user has already seen.
"""

import argparse
import json
import os
import sys

import lancedb
import numpy as np
import pandas as pd


DB_PATH = "/home/user/project/data"
ITEMS_TABLE = "items"
HISTORY_TABLE = "user_history"
MAX_RECENT_INTERACTIONS = 10
DEFAULT_BLEND_ALPHA = 0.3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Personalized recommender that blends a user's recent taste "
            "with a current query vector and searches the LanceDB catalogue."
        )
    )
    parser.add_argument(
        "--user-id",
        required=True,
        help="Target user ID string used to look up the user's history.",
    )
    parser.add_argument(
        "--query-vec",
        required=True,
        help="Path to a .npy file containing the query vector.",
    )
    parser.add_argument(
        "--k",
        required=True,
        type=int,
        help="Number of top recommendation candidates to return.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to the output JSON file where results will be written.",
    )
    return parser.parse_args()


def get_recent_interactions(
    user_history: "lancedb.table.Table", user_id: str, limit: int
) -> pd.DataFrame:
    """Return the most recent `limit` interactions for the user, sorted desc by ts."""
    history_df = user_history.to_pandas()
    user_df = history_df[history_df["user_id"] == user_id]
    if user_df.empty:
        return user_df
    user_df = user_df.sort_values("ts", ascending=False).head(limit)
    return user_df.reset_index(drop=True)


def compute_taste_vector(
    items_table: "lancedb.table.Table", seen_item_ids: list[int]
) -> np.ndarray | None:
    """Look up item embeddings for the seen IDs and return their mean, or None."""
    if not seen_item_ids:
        return None
    items_df = items_table.to_pandas()
    matched = items_df[items_df["id"].isin(seen_item_ids)]
    if matched.empty:
        return None
    embeddings = np.stack(matched["vector"].to_numpy()).astype(np.float32)
    return embeddings.mean(axis=0)


def build_blended_vector(
    query_vec: np.ndarray, taste_vec: np.ndarray | None, alpha: float
) -> np.ndarray:
    """Blend the query and taste vectors using `alpha` as the taste weight."""
    if taste_vec is None:
        return query_vec
    return (1.0 - alpha) * query_vec + alpha * taste_vec


def search_candidates(
    items_table: "lancedb.table.Table",
    query_vec: np.ndarray,
    exclude_ids: list[int],
    k: int,
) -> list[int]:
    """Run a vector search on the items table and return the top-k candidate IDs.

    Items whose IDs are in `exclude_ids` are filtered out via a SQL `where`
    clause so they are not considered as candidates.
    """
    search = items_table.search(query_vec.tolist())
    if exclude_ids:
        ids_list = ", ".join(str(int(i)) for i in exclude_ids)
        search = search.where(f"id NOT IN ({ids_list})")
    results = search.limit(k).to_pandas()
    return [int(i) for i in results["id"].tolist()]


def recommend(
    user_id: str,
    query_vec_path: str,
    k: int,
    output_path: str,
    db_path: str = DB_PATH,
    alpha: float | None = None,
) -> list[int]:
    """End-to-end personalization pipeline; returns the top-k item IDs."""
    if alpha is None:
        alpha = DEFAULT_BLEND_ALPHA

    if not os.path.isfile(query_vec_path):
        raise FileNotFoundError(f"Query vector file not found: {query_vec_path}")

    query_vec = np.load(query_vec_path).astype(np.float32)
    if query_vec.ndim != 1:
        query_vec = query_vec.reshape(-1)

    db = lancedb.connect(db_path)
    items_table = db.open_table(ITEMS_TABLE)
    user_history = db.open_table(HISTORY_TABLE)

    recent = get_recent_interactions(user_history, user_id, MAX_RECENT_INTERACTIONS)
    seen_item_ids = [int(i) for i in recent["item_id"].tolist()]

    taste_vec = compute_taste_vector(items_table, seen_item_ids)
    blended_vec = build_blended_vector(query_vec, taste_vec, alpha)

    top_ids = search_candidates(items_table, blended_vec, seen_item_ids, k)

    output_dir = os.path.dirname(os.path.abspath(output_path))
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(top_ids, f)

    return top_ids


def main() -> int:
    args = parse_args()

    alpha_env = os.environ.get("BLEND_ALPHA")
    if alpha_env is not None:
        try:
            alpha = float(alpha_env)
        except ValueError:
            print(
                f"Invalid BLEND_ALPHA={alpha_env!r}; falling back to default "
                f"{DEFAULT_BLEND_ALPHA}",
                file=sys.stderr,
            )
            alpha = DEFAULT_BLEND_ALPHA
    else:
        alpha = DEFAULT_BLEND_ALPHA

    try:
        top_ids = recommend(
            user_id=args.user_id,
            query_vec_path=args.query_vec,
            k=args.k,
            output_path=args.output,
            alpha=alpha,
        )
    except Exception as exc:  # pragma: no cover - top-level error reporting
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print(f"Recommended {len(top_ids)} item(s) for user '{args.user_id}': {top_ids}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
