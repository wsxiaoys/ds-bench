# Real-time Top-K Leaderboard with Bytewax

## Background
In gaming and analytics, maintaining a real-time leaderboard is a common requirement. You need to build a dataflow using Bytewax that processes a continuous stream of player score updates, maintains the maximum score achieved by each player, and continuously computes the global Top-K players.

## Requirements
- The project path is `/home/user/bytewax_project`.
- The task must be implemented in a Python script named `leaderboard.py` in the project directory.
- The script must accept command-line arguments: `--input <input_file>` (path to input JSONL file), `--output <output_file>` (path to output JSON file), and `--k <k>` (number of top players to maintain).
- The script must read player score events from the input JSONL file `<input_file>`, where each line is a JSON object with the format `{"player_id": string, "score": number}`.
- Use stateful processing to track the highest score ever achieved by each player.
- Maintain a global state to track the top K players overall based on their highest scores.
- Output the final Top-K leaderboard as a single JSON array to `<output_file>` upon completion of the stream, sorted by score in descending order. Format: `[{"player_id": string, "score": number}, ...]`.

## Implementation Hints
- Use `bytewax.operators.stateful_map` or similar stateful operators to maintain the maximum score per player.
- To compute the global Top-K, you will need to route the updated player maximum scores to a single worker (e.g., by mapping to a constant key) and use another stateful operator to maintain the sorted Top-K list.
- Ensure the Top-K state is updated efficiently (e.g., using a min-heap or sorted list of size K) rather than keeping all players in memory.

