import json
import argparse
from bytewax.dataflow import Dataflow
import bytewax.operators as op
from bytewax.testing import TestingSource, TestingSink, run_main

def jsonl_generator(file_path):
    """
    Generator to read a JSONL file line by line and yield (player_id, score).
    """
    with open(file_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                yield (event["player_id"], event["score"])
            except Exception:
                # Ignore invalid or malformed lines
                continue

def update_max_score(state, new_score):
    """
    Stateful operator function to track the highest score ever achieved by each player.
    Returns (updated_state, emit_values). Emits the new score only if it is a new high score.
    """
    if state is None or new_score > state:
        state = new_score
        return (state, [state])
    return (state, [])

def build_global_top_k_updater(k):
    """
    Returns a mapper function that maintains the global top K players.
    """
    def update_global_top_k(state, value):
        """
        Stateful operator function to maintain the top K players overall.
        state: dict mapping player_id to their maximum score.
        value: tuple (player_id, score).
        """
        if state is None:
            state = {}
        
        player_id, score = value
        
        # 1. If player is already in the top-K state, update their score
        if player_id in state:
            state[player_id] = score
        else:
            # 2. If player is not in the top-K and we have room, add them
            if len(state) < k:
                state[player_id] = score
            else:
                # 3. If we don't have room, find the player with the minimum score
                min_player = min(state, key=state.get)
                if score > state[min_player]:
                    del state[min_player]
                    state[player_id] = score
                    
        # Sort the top K players by score in descending order
        sorted_top_k = sorted(state.items(), key=lambda item: item[1], reverse=True)
        emit_value = [{"player_id": p, "score": s} for p, s in sorted_top_k]
        
        return (state, emit_value)
    
    return update_global_top_k

def main():
    parser = argparse.ArgumentParser(description="Real-time Top-K Leaderboard with Bytewax")
    parser.add_argument("--input", required=True, help="Path to input JSONL file")
    parser.add_argument("--output", required=True, help="Path to output JSON file")
    parser.add_argument("--k", required=True, type=int, help="Number of top players to maintain")
    args = parser.parse_args()
    
    if args.k <= 0:
        raise ValueError("The parameter k must be a positive integer.")
    
    flow = Dataflow("leaderboard_flow")
    
    # 1. Read input JSONL file
    input_generator = jsonl_generator(args.input)
    s = op.input("inp", flow, TestingSource(input_generator))
    
    # 2. Stateful flat_map to track the highest score per player
    s = op.stateful_flat_map("max_score", s, update_max_score)
    
    # 3. Route to a single worker by mapping to a constant key
    s = op.map("route_to_global", s, lambda item: ("global_leaderboard", (item[0], item[1])))
    
    # 4. Global stateful map to track the top K players overall
    s = op.stateful_map("global_top_k", s, build_global_top_k_updater(args.k))
    
    # 5. Output to a list using TestingSink
    out = []
    op.output("out", s, TestingSink(out))
    
    # Run the dataflow
    run_main(flow)
    
    # Write the final Top-K leaderboard to the output file
    final_leaderboard = []
    if out:
        # The last element of out contains the final Top-K leaderboard
        final_leaderboard = out[-1][1]
        
    with open(args.output, "w") as f:
        json.dump(final_leaderboard, f, indent=2)

if __name__ == "__main__":
    main()
