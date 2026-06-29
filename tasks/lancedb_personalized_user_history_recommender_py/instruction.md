# Personalized User-History Recommender with LanceDB

## Background
A simple e-commerce recommender needs to personalize search results based on what each user has previously interacted with. The catalogue is stored in LanceDB and you must implement a Python script that blends a user's recent taste with the current query and runs a vector search against the catalogue, excluding items the user has already seen.

## Requirements
Implement a CLI script named `recommend.py` at `/home/user/project/recommend.py` that:
- Accepts the following command-line arguments:
  - `--user-id`: The target user ID string.
  - `--query-vec`: Path to a `.npy` file containing the query vector.
  - `--k`: The number of top recommendation candidates to return (integer).
  - `--output`: Path to the output JSON file where results will be written.
- Loads up to the 10 most recent interactions for the given user from the `user_history` LanceDB table.
- Joins the interacted item IDs back to the `items` table to retrieve their embeddings.
- Computes a "user taste vector" as the mean of those item embeddings.
- Blends the taste vector with the current query vector using a configurable blending coefficient `alpha`.
- Runs vector search on the `items` table against the blended vector.
- Excludes items the user has already interacted with from the returned candidates.
- Writes the top-k item IDs (in rank order) as a JSON array of integers to the output file.

## Implementation Hints
- The LanceDB database lives at `/home/user/project/data`. Use `lancedb.connect(...)` and `open_table(...)` to access `items` and `user_history`. Do not recreate or modify these tables.
- The `user_history` table has columns `user_id`, `item_id`, `rating`, `ts` (microsecond timestamp). Use the timestamp column to take the 10 most recent rows per user.
- The `items` table has columns `id`, `title`, `category`, and a 64-d `vector` column.
- The blending coefficient is read from the `BLEND_ALPHA` environment variable; default is `0.3`. The blended vector is `(1 - alpha) * query + alpha * taste`. When the user has no history, fall back to the pure query vector.
- Build the candidate query using LanceDB's vector search API and exclude already-seen items via a SQL `where` clause (for example a `NOT IN (...)` predicate over the user's seen item IDs).
- Read the query vector from a `.npy` file path passed on the command line and write results as a JSON list of integers.

