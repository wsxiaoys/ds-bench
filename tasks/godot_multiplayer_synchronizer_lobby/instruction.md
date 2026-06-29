# Godot 4 High-Level Multiplayer Lobby (ENet + MultiplayerSpawner + MultiplayerSynchronizer)

## Background
Build a Godot 4 high-level multiplayer lobby that runs an ENet host **and** several ENet clients inside a single headless Godot process using loopback (`127.0.0.1`). The host spawns a `Player` node for each connecting peer through a `MultiplayerSpawner`. Each `Player` carries a `MultiplayerSynchronizer` that replicates state, plus an RPC that lets any peer mutate the per-player score and have the change propagated to every other peer.

## Requirements

### Core Requirements
- Implement the project so a single invocation of `godot --headless` is enough to start the server, spin up N ENet clients on the same machine, exchange `MultiplayerSynchronizer` state, dispatch a score-update RPC from every client, and write a final-state JSON.
- Players are spawned dynamically through `MultiplayerSpawner` (no hard-coded children in `Players` in the scene file).
- Each `Player` node's *multiplayer authority* equals the peer ID it represents (the host's player has authority `1`, client players have authority equal to their unique multiplayer ID).
- A `MultiplayerSynchronizer` on each `Player` replicates the `Player.position` (Vector2) to every peer.
- A `@rpc("any_peer", "call_local")` function with exact signature `update_score(value: int)` mutates an integer `score` field on the `Player`.
- The harness must support deterministic frame pumping so the final state is reproducible.

### Project Structure and Required Files
The project must be located at `/home/user/myproject` and contain the following files:
- `/home/user/myproject/project.godot`
- `/home/user/myproject/main.tscn` (root node named `Main`, script `res://main.gd`)
- `/home/user/myproject/main.gd`
- `/home/user/myproject/player.tscn` (root node named `Player`, script `res://player.gd`, contains a child `MultiplayerSynchronizer` that replicates `Player:position`)
- `/home/user/myproject/player.gd`

In `player.gd`, you must define an integer property `score` (initial value `0`) and an RPC with the **exact** annotation and signature:
```gdscript
@rpc("any_peer", "call_local")
func update_score(value: int) -> void:
    score += value
```

### Execution and CLI Arguments
The project will be executed using the following command:
`godot --headless --path /home/user/myproject res://main.tscn -- --port=<port> --clients=<n> --frames=<frames> --score-deltas=<csv> --out=<json_path>`

Your script must parse these custom arguments passed after the `--` separator:
- `--port`: The port to run the server on and connect clients to.
- `--clients`: The number of client peers to spawn.
- `--frames`: The number of frames to pump before writing the state and exiting.
- `--score-deltas`: A comma-separated list of integers representing the score deltas to apply to clients.
- `--out`: The output path where the final-state JSON must be written.

The process must exit with status `0` after writing the JSON.

### Output JSON Schema and Semantics
After successful execution, the file at `<json_path>` must exist and conform to the following schema:
```json
{
  "server": {
    "unique_id": 1,
    "peers": [<int>, ...],
    "players": {
      "<peer_id>": {"authority": <peer_id>, "position": [<x>, <y>], "score": <int>}
    }
  },
  "clients": [
    {
      "unique_id": <int>,
      "peers": [<int>, ...],
      "players": {
        "<peer_id>": {"authority": <peer_id>, "position": [<x>, <y>], "score": <int>}
      }
    }
  ]
}
```

#### JSON Semantics:
- Peer-id keys inside `"players"` must be JSON strings, and the list of `"peers"` must be sorted in ascending order.
- `server.unique_id` must be `1`.
- `server.peers` must equal the sorted list of every client's `unique_id` (the host/server does not list itself).
- Every client's `peers` list must equal the sorted list of all other peer IDs, including the server (`1`).
- `players` keys must be identical across all peers and equal to the set of every connected peer's `unique_id` (one `Player` per peer in the lobby, including the host).
- Each player's `authority` must equal its key.
- Each player's `position` must equal `[authority, authority]` (set by the authoritative peer; values are 32-bit floats and small precision loss is allowed for large peer IDs). For example, the host (authority `1`) must set its position to `Vector2(1, 1)`, and client with ID `12345` must set its position to `Vector2(12345, 12345)`.
- Each player's `score` must equal the score delta passed for the matching client index (the host's player score stays `0` because the host does not call the RPC).
- The `clients` array must preserve the CLI client order: index 0 corresponds to the first client spawned, etc.

## Implementation Hints
- Use `ENetMultiplayerPeer.create_server(port, max_clients)` for the host and `ENetMultiplayerPeer.create_client("127.0.0.1", port)` for each client.
- Run all peers in **one** Godot process by giving each peer its own `SceneMultiplayer` instance and attaching it to a distinct subtree via `SceneTree.set_multiplayer(api, NodePath)`. RPC paths are resolved relative to each multiplayer root, so put the spawner/players at the same *relative* path under every peer's root.
- The `MultiplayerSpawner` should reference `res://player.tscn` in its `_spawnable_scenes` and point its `spawn_path` at the `Players` container.
- Set the player's authority via `set_multiplayer_authority(peer_id)` on the server right after the host spawns it; the synchronizer will propagate the position written by the authority.
- Pump frames by repeatedly calling `await get_tree().process_frame` from a coroutine. Quit with `get_tree().quit()` once the final-state JSON has been written.
- The CLI flag `--score-deltas` provides a comma-separated list of integers; the i-th client must invoke `update_score.rpc(deltas[i])` exactly once on its own player after the spawn is observed.
