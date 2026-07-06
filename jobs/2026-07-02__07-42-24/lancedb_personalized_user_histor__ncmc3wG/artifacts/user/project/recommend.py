#!/usr/bin/env python3
import os
import sys
import argparse
import json
import numpy as np
import lancedb

def main():
    parser = argparse.ArgumentParser(description="Personalized User-History Recommender using LanceDB")
    parser.add_argument("--user-id", required=True, help="The target user ID string.")
    parser.add_argument("--query-vec", required=True, help="Path to a .npy file containing the query vector.")
    parser.add_argument("--k", type=int, required=True, help="The number of top recommendation candidates to return.")
    parser.add_argument("--output", required=True, help="Path to the output JSON file where results will be written.")
    
    args = parser.parse_args()
    
    # 1. Load the query vector from the .npy file
    if not os.path.exists(args.query-vec if hasattr(args, 'query-vec') else args.query_vec):
        print(f"Error: Query vector file not found at {args.query_vec}", file=sys.stderr)
        sys.exit(1)
    
    query_vector = np.load(args.query_vec)
    
    # 2. Connect to the LanceDB database
    db_path = "/home/user/project/data"
    if not os.path.exists(db_path):
        print(f"Error: LanceDB database not found at {db_path}", file=sys.stderr)
        sys.exit(1)
        
    db = lancedb.connect(db_path)
    
    # Open the tables
    try:
        user_history_tbl = db.open_table("user_history")
    except Exception as e:
        print(f"Error opening user_history table: {e}", file=sys.stderr)
        sys.exit(1)
        
    try:
        items_tbl = db.open_table("items")
    except Exception as e:
        print(f"Error opening items table: {e}", file=sys.stderr)
        sys.exit(1)
        
    # 3. Load user interaction history
    # Escape single quotes in user_id to prevent SQL injection issues in the where clause
    safe_user_id = args.user_id.replace("'", "''")
    try:
        history_df = user_history_tbl.search().where(f"user_id = '{safe_user_id}'").to_pandas()
    except Exception as e:
        print(f"Error querying user history: {e}", file=sys.stderr)
        sys.exit(1)
        
    # Read the blending coefficient alpha
    alpha_env = os.environ.get("BLEND_ALPHA", "0.3")
    try:
        alpha = float(alpha_env)
    except ValueError:
        alpha = 0.3
        
    taste_vector = None
    seen_item_ids = []
    
    if not history_df.empty:
        # Get all interacted items for exclusion
        seen_item_ids = history_df["item_id"].unique().tolist()
        
        # Take the 10 most recent rows based on the 'ts' timestamp column
        recent_history = history_df.sort_values(by="ts", ascending=False).head(10)
        recent_item_ids = recent_history["item_id"].tolist()
        
        if recent_item_ids:
            # Join back to items table to retrieve their embeddings
            recent_ids_str = ",".join(str(i) for i in recent_item_ids)
            try:
                items_df = items_tbl.search().where(f"id IN ({recent_ids_str})").to_pandas()
            except Exception as e:
                print(f"Error retrieving item embeddings: {e}", file=sys.stderr)
                items_df = None
                
            if items_df is not None and not items_df.empty and "vector" in items_df.columns:
                # Compute user taste vector as the mean of item embeddings
                embeddings = np.stack(items_df["vector"].values)
                taste_vector = np.mean(embeddings, axis=0)

    # 4. Blend taste vector with query vector
    if taste_vector is not None:
        blended_vector = (1.0 - alpha) * query_vector + alpha * taste_vector
    else:
        # Fall back to pure query vector when the user has no history or no embeddings
        blended_vector = query_vector
        
    # 5. Run vector search on items table
    try:
        search_query = items_tbl.search(blended_vector)
        if seen_item_ids:
            seen_ids_str = ",".join(str(i) for i in seen_item_ids)
            search_query = search_query.where(f"id NOT IN ({seen_ids_str})")
        
        results_df = search_query.limit(args.k).to_pandas()
    except Exception as e:
        print(f"Error during vector search: {e}", file=sys.stderr)
        sys.exit(1)
        
    # Extract item IDs in rank order
    top_k_ids = []
    if not results_df.empty and "id" in results_df.columns:
        top_k_ids = [int(x) for x in results_df["id"].tolist()]
        
    # Ensure the output directory exists
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        
    # Write output to JSON file
    try:
        with open(args.output, "w") as f:
            json.dump(top_k_ids, f)
    except Exception as e:
        print(f"Error writing output file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
