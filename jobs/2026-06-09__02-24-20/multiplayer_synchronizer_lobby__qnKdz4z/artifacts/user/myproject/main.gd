extends Node

# ---------------------------------------------------------------------------
# CLI argument storage
# ---------------------------------------------------------------------------
var _port: int = 0
var _client_count: int = 0
var _frames: int = 0
var _score_deltas: PackedInt32Array = []
var _out_path: String = ""

# ---------------------------------------------------------------------------
# Peer data structures
# ---------------------------------------------------------------------------
class PeerData:
	var root: Node
	var multiplayer_api: SceneMultiplayer
	var peer: ENetMultiplayerPeer
	var players_node: Node
	var spawner: MultiplayerSpawner

var _server_data: PeerData = null
var _client_data_list: Array[PeerData] = []

# Maps client index -> whether that client's score RPC has been called
var _score_rpc_called: Array[bool] = []

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
func _ready() -> void:
	_parse_args()
	_setup_all_peers()
	_pump_frames_async()

# ---------------------------------------------------------------------------
# CLI parsing
# ---------------------------------------------------------------------------
func _parse_args() -> void:
	var args: PackedStringArray = OS.get_cmdline_user_args()
	var i := 0
	while i < args.size():
		var arg: String = args[i]
		match arg:
			"--port":
				i += 1
				_port = args[i].to_int()
			"--clients":
				i += 1
				_client_count = args[i].to_int()
			"--frames":
				i += 1
				_frames = args[i].to_int()
			"--score-deltas":
				i += 1
				_score_deltas = _parse_int_csv(args[i])
			"--out":
				i += 1
				_out_path = args[i]
			_:
				pass
		i += 1

func _parse_int_csv(csv: String) -> PackedInt32Array:
	var result: PackedInt32Array = []
	if csv == "":
		return result
	for token in csv.split(","):
		result.append(token.to_int())
	return result

# ---------------------------------------------------------------------------
# Peer setup
# ---------------------------------------------------------------------------
func _setup_all_peers() -> void:
	# --- Server ---
	_server_data = _create_peer(_port, true)

	# --- Clients ---
	for _idx in range(_client_count):
		var client_data := _create_peer(_port, false)
		_client_data_list.append(client_data)
		_score_rpc_called.append(false)

func _create_peer(port: int, is_server: bool) -> PeerData:
	var data := PeerData.new()

	# Create the subtree root
	data.root = Node.new()
	data.root.name = "ServerRoot" if is_server else "ClientRoot_%d" % (_client_data_list.size())
	add_child(data.root)

	# Create a dedicated SceneMultiplayer for this peer
	data.multiplayer_api = SceneMultiplayer.new()
	data.root.set_multiplayer(data.multiplayer_api)

	# Build the multiplayer peer
	data.peer = ENetMultiplayerPeer.new()
	if is_server:
		data.peer.create_server(port, max(1, _client_count))
	else:
		data.peer.create_client("127.0.0.1", port)

	data.multiplayer_api.multiplayer_peer = data.peer

	# --- Build the spawner subtree under this peer's root ---
	# Players container
	data.players_node = Node.new()
	data.players_node.name = "Players"
	data.root.add_child(data.players_node)

	# MultiplayerSpawner
	data.spawner = MultiplayerSpawner.new()
	data.spawner.name = "MultiplayerSpawner"
	data.spawner.spawn_path = NodePath("../Players")
	data.spawner.spawn_function = _spawn_player
	data.root.add_child(data.spawner)

	# Connect signals
	data.peer.peer_connected.connect(_on_peer_connected.bind(data))
	data.spawner.spawned.connect(_on_player_spawned.bind(data))

	return data

# ---------------------------------------------------------------------------
# Custom spawn function for MultiplayerSpawner
# ---------------------------------------------------------------------------
func _spawn_player(spawn_data: Variant) -> Node:
	var player := load("res://player.tscn").instantiate()
	var peer_id: int = spawn_data as int
	player.set_multiplayer_authority(peer_id)
	player.name = str(peer_id)
	return player

# ---------------------------------------------------------------------------
# Peer connected -> spawn a player for the new peer (server only)
# ---------------------------------------------------------------------------
func _on_peer_connected(peer_id: int, data: PeerData) -> void:
	if data == _server_data:
		data.spawner.spawn(peer_id)

# ---------------------------------------------------------------------------
# Player spawned on any peer
# ---------------------------------------------------------------------------
func _on_player_spawned(player: Node, data: PeerData) -> void:
	# The player node is already configured with correct authority from _spawn_player.
	# The _ready() in player.gd will set its position using the authority.
	pass

# ---------------------------------------------------------------------------
# Frame pumping
# ---------------------------------------------------------------------------
func _pump_frames_async() -> void:
	# Give peers time to connect.
	await get_tree().process_frame
	await get_tree().process_frame

	# Spawn the server's own player (peer 1)
	_server_data.spawner.spawn(1)

	# Wait for all connections and spawns to propagate.
	# Also retry score RPCs in case players haven't spawned yet on clients.
	for _i in range(max(10, _frames + 5)):
		# Try to trigger score RPCs (idempotent — only fires once per client)
		for idx in range(_client_data_list.size()):
			_trigger_score_rpc(idx)

		await get_tree().process_frame

	# Collect and write final state
	_write_final_state()
	get_tree().quit()

# ---------------------------------------------------------------------------
# Trigger score RPC from a client
# ---------------------------------------------------------------------------
func _trigger_score_rpc(client_idx: int) -> void:
	if _score_rpc_called[client_idx]:
		return
	if client_idx >= _score_deltas.size():
		return

	var data := _client_data_list[client_idx]
	var delta: int = _score_deltas[client_idx]

	# Find the client's own player node in its subtree
	var players_node := data.players_node
	for child in players_node.get_children():
		if child.has_method("update_score"):
			var child_id: int = child.get_multiplayer_authority()
			var my_id: int = data.multiplayer_api.get_unique_id()
			if child_id == my_id:
				child.update_score.rpc(delta)
				_score_rpc_called[client_idx] = true
				return

# ---------------------------------------------------------------------------
# Gather state from a peer's subtree
# ---------------------------------------------------------------------------
func _gather_peer_state(data: PeerData) -> Dictionary:
	var own_id: int = data.multiplayer_api.get_unique_id()

	var peers_list: Array[int] = []
	for p in data.peer.get_peers():
		if p != own_id:
			peers_list.append(p)
	peers_list.sort()

	var players_dict := {}
	var players_node := data.players_node
	for child in players_node.get_children():
		if child.has_method("update_score"):
			var pid_str: String = child.name
			var pos: Vector2 = child.position
			var scr: int = child.score
			players_dict[pid_str] = {
				"authority": child.get_multiplayer_authority(),
				"position": [pos.x, pos.y],
				"score": scr
			}

	return {
		"unique_id": own_id,
		"peers": peers_list,
		"players": players_dict
	}

# ---------------------------------------------------------------------------
# Write final JSON
# ---------------------------------------------------------------------------
func _write_final_state() -> void:
	var server_state := _gather_peer_state(_server_data)

	var client_states: Array = []
	for cdata in _client_data_list:
		client_states.append(_gather_peer_state(cdata))

	var output := {
		"server": server_state,
		"clients": client_states
	}

	var json_str := JSON.stringify(output, "\t")
	var file := FileAccess.open(_out_path, FileAccess.WRITE)
	if file:
		file.store_string(json_str)
		file.close()
