extends Node

# ------------------------------------------------------------------
# CLI configuration (populated from --key=value arguments after `--`).
# ------------------------------------------------------------------
var port: int = 9999
var client_count: int = 1
var total_frames: int = 30
var score_deltas: PackedInt64Array = PackedInt64Array()
var out_path: String = "user://output.json"

# ------------------------------------------------------------------
# Server subtree (multiplayer authority lives under /root/Server).
# ------------------------------------------------------------------
var server_root: Node = null
var server_players_node: Node = null
var server_spawner: MultiplayerSpawner = null
var server_multiplayer: SceneMultiplayer = null

# ------------------------------------------------------------------
# Client subtrees, one per spawned ENet client.
# ------------------------------------------------------------------
var client_roots: Array[Node] = []
var client_players_nodes: Array[Node] = []
var client_spawners: Array[MultiplayerSpawner] = []
var client_multiplayers: Array[SceneMultiplayer] = []
var client_connected: Array[bool] = []
var score_rpc_dispatched: Array[bool] = []

const PLAYER_SCENE: PackedScene = preload("res://player.tscn")

# ------------------------------------------------------------------
# Lifecycle.
# ------------------------------------------------------------------
func _ready() -> void:
	parse_args()
	# Defer the actual start to give the engine time to wire up the
	# SceneTree (and so deferred calls land in the right context).
	call_deferred("_start")

func _start() -> void:
	setup_server()
	setup_clients()
	# Kick off the orchestrator on the next frame so all peers are wired
	# up before the first await resumes.
	await get_tree().process_frame
	await _run_lobby()
	_write_json()
	get_tree().quit(0)

# ------------------------------------------------------------------
# CLI parsing.
# ------------------------------------------------------------------
func parse_args() -> void:
	var args := OS.get_cmdline_user_args()
	var i := 0
	while i < args.size():
		var arg: String = args[i]
		match arg:
			"--port":
				i += 1
				if i < args.size():
					port = int(args[i])
			"--clients":
				i += 1
				if i < args.size():
					client_count = int(args[i])
			"--frames":
				i += 1
				if i < args.size():
					total_frames = int(args[i])
			"--score-deltas":
				i += 1
				if i < args.size():
					score_deltas = PackedInt64Array()
					for part in String(args[i]).split(","):
						var s := String(part).strip_edges()
						if s != "":
							score_deltas.append(int(s))
			"--out":
				i += 1
				if i < args.size():
					out_path = String(args[i])
		i += 1

# ------------------------------------------------------------------
# Per-peer setup.
# ------------------------------------------------------------------
func setup_server() -> void:
	# Build the server subtree: /root/Server/{Players, Spawner}.
	server_root = Node.new()
	server_root.name = "Server"
	add_child(server_root)

	server_players_node = Node.new()
	server_players_node.name = "Players"
	server_root.add_child(server_players_node)

	server_spawner = MultiplayerSpawner.new()
	server_spawner.name = "Spawner"
	server_spawner.spawn_path = NodePath("../Players")
	server_spawner._spawnable_scenes = [PLAYER_SCENE]
	server_spawner.spawn_function = Callable(self, "_spawn_player_from_data")
	server_root.add_child(server_spawner)

	# Start the ENet server.
	var server_peer := ENetMultiplayerPeer.new()
	var max_clients: int = max(1, client_count + 4)
	var err: int = server_peer.create_server(port, max_clients)
	if err != OK:
		push_error("Failed to create server on port %d: err=%d" % [port, err])
		get_tree().quit(1)
		return

	server_multiplayer = SceneMultiplayer.new()
	server_multiplayer.multiplayer_peer = server_peer
	server_multiplayer.peer_connected.connect(_on_server_peer_connected)

	# Attach the multiplayer API to the /root/Server subtree so that
	# RPCs/syncs beneath that path are routed through the server's peer.
	get_tree().set_multiplayer(server_multiplayer, server_root.get_path())

func setup_clients() -> void:
	for i in range(client_count):
		var idx: int = i
		var client_root := Node.new()
		client_root.name = "Client%d" % idx
		add_child(client_root)

		var client_players_node := Node.new()
		client_players_node.name = "Players"
		client_root.add_child(client_players_node)

		var client_spawner := MultiplayerSpawner.new()
		client_spawner.name = "Spawner"
		client_spawner.spawn_path = NodePath("../Players")
		client_spawner._spawnable_scenes = [PLAYER_SCENE]
		client_spawner.spawn_function = Callable(self, "_spawn_player_from_data")
		client_root.add_child(client_spawner)

		var client_peer := ENetMultiplayerPeer.new()
		var cerr: int = client_peer.create_client("127.0.0.1", port)
		if cerr != OK:
			push_error("Failed to create client %d: err=%d" % [idx, cerr])
			get_tree().quit(1)
			return

		var client_multiplayer := SceneMultiplayer.new()
		client_multiplayer.multiplayer_peer = client_peer
		client_multiplayer.connected_to_server.connect(_on_client_connected.bind(idx))

		client_roots.append(client_root)
		client_players_nodes.append(client_players_node)
		client_spawners.append(client_spawner)
		client_multiplayers.append(client_multiplayer)
		client_connected.append(false)
		score_rpc_dispatched.append(false)

		get_tree().set_multiplayer(client_multiplayer, client_root.get_path())

# ------------------------------------------------------------------
# Spawn function shared by every peer's MultiplayerSpawner.
# Called on the authority (to instantiate locally) AND on every other
# peer (when they receive the spawn notification).
# ------------------------------------------------------------------
func _spawn_player_from_data(data: Variant) -> Node:
	var peer_id: int = int(data)
	var player: Node2D = PLAYER_SCENE.instantiate()
	player.name = "Player_%d" % peer_id
	# Authority is the peer this player represents.
	player.set_multiplayer_authority(peer_id)
	# Pre-position the player so the synchronizer captures the correct
	# value as its initial state when it enters the tree. This works
	# on every peer (the synchronizer will only replicate from the
	# authoritative peer, but every local copy starts with the right
	# value so reads are consistent even before the first sync).
	player.position = Vector2(float(peer_id), float(peer_id))
	return player

# ------------------------------------------------------------------
# Connection handlers.
# ------------------------------------------------------------------
func _on_server_peer_connected(peer_id: int) -> void:
	# When a client peer connects, the host spawns a Player for it.
	# Spawning here guarantees the spawn notification is sent to a
	# peer that is already connected on the server's multiplayer API.
	server_spawner.spawn(peer_id)

func _on_client_connected(client_index: int) -> void:
	if client_index < 0 or client_index >= client_connected.size():
		return
	client_connected[client_index] = true

# ------------------------------------------------------------------
# Lobby orchestration.
# ------------------------------------------------------------------
func _run_lobby() -> void:
	# 1. Spawn the host's own player first (authority = 1).
	#    At this moment no other peer is connected yet; the spawner
	#    instantiates the player locally only. When each client connects
	#    later, the spawner will resend every existing spawn as part of
	#    its visibility-update handshake, so newly-connected peers still
	#    learn about the host's player.
	server_spawner.spawn(1)

	# 2. Wait for every ENet client to finish its handshake.
	var wait_frames: int = 0
	while not _all_clients_connected() and wait_frames < 600:
		await get_tree().process_frame
		wait_frames += 1
	if wait_frames >= 600 and not _all_clients_connected():
		push_error("Timed out waiting for clients to connect")
		get_tree().quit(1)
		return

	# 3. Wait for the server's Players container to hold 1 + client_count
	#    children (the host + every client).
	wait_frames = 0
	var expected_player_count: int = 1 + client_count
	while server_players_node.get_child_count() < expected_player_count and wait_frames < 600:
		await get_tree().process_frame
		wait_frames += 1

	# 4. Wait for every client subtree to mirror the same set of players.
	wait_frames = 0
	while not _all_peers_have_all_players(expected_player_count) and wait_frames < 600:
		await get_tree().process_frame
		wait_frames += 1

	# 5. Give the synchronizer a few frames to push the initial state to
	#    every peer (the host's position Vector2(1,1) and each client's
	#    position Vector2(N,N)).
	for _i in range(6):
		await get_tree().process_frame

	# 6. Each client invokes update_score.rpc(delta) on its own player.
	#    Because the RPC is annotated call_local, every peer (including
	#    the sender) increments score locally. Other clients receive the
	#    call via the RPC router and run it on their local copies.
	for i in range(client_count):
		if score_rpc_dispatched[i]:
			continue
		var client_mp: SceneMultiplayer = client_multiplayers[i]
		if client_mp.multiplayer_peer == null or client_mp.multiplayer_peer.get_connection_status() != MultiplayerPeer.CONNECTION_CONNECTED:
			continue
		var peer_id: int = client_mp.multiplayer_peer.get_unique_id()
		var players_node: Node = client_players_nodes[i]
		var player_name: String = "Player_%d" % peer_id
		if not players_node.has_node(player_name):
			continue
		var my_player: Node = players_node.get_node(player_name)
		var delta: int = 0
		if i < score_deltas.size():
			delta = int(score_deltas[i])
		my_player.update_score.rpc(delta)
		score_rpc_dispatched[i] = true

	# 7. Pump frames so RPCs and synchronizer updates fully propagate
	#    before we sample the final state.
	var frames_pumped: int = 0
	while frames_pumped < total_frames:
		await get_tree().process_frame
		frames_pumped += 1

func _all_clients_connected() -> bool:
	if client_connected.size() != client_count:
		return false
	for c in client_connected:
		if not c:
			return false
	return true

func _all_peers_have_all_players(expected: int) -> bool:
	if server_players_node.get_child_count() < expected:
		return false
	for pn in client_players_nodes:
		if pn.get_child_count() < expected:
			return false
	return true

# ------------------------------------------------------------------
# Snapshot final state and write JSON.
# ------------------------------------------------------------------
func _write_json() -> void:
	var doc: Dictionary = {}

	# Server snapshot.
	var server_snapshot: Dictionary = _snapshot_peer(
		server_multiplayer, server_players_node, false)
	doc["server"] = server_snapshot

	# Client snapshots in CLI spawn order.
	var client_arr: Array = []
	for i in range(client_count):
		var snap: Dictionary = _snapshot_peer(
			client_multiplayers[i], client_players_nodes[i], true)
		client_arr.append(snap)
	doc["clients"] = client_arr

	var text: String = JSON.stringify(doc, "\t")
	var f: FileAccess = FileAccess.open(out_path, FileAccess.WRITE)
	if f == null:
		push_error("Could not open output file: %s (err=%d)" % [out_path, FileAccess.get_open_error()])
		get_tree().quit(1)
		return
	f.store_string(text)
	f.close()

func _snapshot_peer(mp: SceneMultiplayer, players_node: Node, include_self: bool) -> Dictionary:
	var unique_id: int = 0
	if mp != null and mp.multiplayer_peer != null:
		unique_id = mp.multiplayer_peer.get_unique_id()
	# Enumerate connected peers via the multiplayer API.
	var peer_ids: Array = []
	if mp != null:
		var connected: PackedInt32Array = mp.get_peers()
		for p in connected:
			peer_ids.append(int(p))
	peer_ids.sort()
	# Build the players dict, keyed by stringified peer_id.
	var players_dict: Dictionary = {}
	# Always include the server (1) and every connected client.
	var ids_to_emit: Array = []
	ids_to_emit.append(1)
	for p in peer_ids:
		if int(p) != 1:
			ids_to_emit.append(int(p))
	ids_to_emit.sort()
	for pid in ids_to_emit:
		var node_name: String = "Player_%d" % int(pid)
		var player_node: Node = null
		if players_node != null and players_node.has_node(node_name):
			player_node = players_node.get_node(node_name)
		var entry: Dictionary = {}
		var auth: int = int(pid)
		entry["authority"] = auth
		if player_node != null:
			var pos: Vector2 = player_node.position
			entry["position"] = [pos.x, pos.y]
			if "score" in player_node:
				entry["score"] = int(player_node.score)
			else:
				entry["score"] = 0
		else:
			entry["position"] = [0.0, 0.0]
			entry["score"] = 0
		players_dict[str(int(pid))] = entry

	# server.peers must equal the sorted list of client unique_ids
	# (does not include itself). clients[i].peers must equal the sorted
	# list of all other peer IDs, including the server (1).
	var peers_out: Array = []
	if include_self:
		# client snapshot: include every other peer including server (1).
		var others: Array = []
		if unique_id != 1:
			others.append(1)
		for p in peer_ids:
			if int(p) != unique_id:
				others.append(int(p))
		others.sort()
		peers_out = others
	else:
		# server snapshot: just the client unique_ids, no self.
		var others: Array = []
		for p in peer_ids:
			if int(p) != 1:
				others.append(int(p))
		others.sort()
		peers_out = others

	return {
		"unique_id": unique_id,
		"peers": peers_out,
		"players": players_dict,
	}