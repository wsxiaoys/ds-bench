extends Node

# ---------------------------------------------------------------------------
# CLI-parsed configuration
# ---------------------------------------------------------------------------
var _port: int = 4200
var _num_clients: int = 2
var _num_frames: int = 120
var _score_deltas: Array = []   # Array[int]
var _out_path: String = "/tmp/result.json"

# ---------------------------------------------------------------------------
# Per-peer bookkeeping
# ---------------------------------------------------------------------------
# Each entry in these arrays corresponds to one logical peer (index 0 = server,
# indices 1..N = clients in CLI order).

var _apis: Array = []           # SceneMultiplayer
var _enets: Array = []          # ENetMultiplayerPeer
var _roots: Array = []          # Node  (subtree root)
var _spawners: Array = []       # MultiplayerSpawner

# Map peer_index -> Set of peer_ids whose Player this peer has already observed
# so we fire the score RPC exactly once per client.
var _score_sent: Array = []     # Array[bool]

# Pre-loaded player scene resource (set once in _run before any spawning).
var _player_scene: PackedScene = null

# ---------------------------------------------------------------------------
# _ready : parse args then kick off the async harness
# ---------------------------------------------------------------------------
func _ready() -> void:
	_parse_args()
	# call_deferred ensures the scene tree is fully set up before we start.
	_run.call_deferred()

func _parse_args() -> void:
	var args: Array = OS.get_cmdline_user_args()
	for arg in args:
		if arg.begins_with("--port="):
			_port = int(arg.substr(7))
		elif arg.begins_with("--clients="):
			_num_clients = int(arg.substr(10))
		elif arg.begins_with("--frames="):
			_num_frames = int(arg.substr(9))
		elif arg.begins_with("--score-deltas="):
			var csv: String = arg.substr(15)
			if csv != "":
				for s in csv.split(","):
					_score_deltas.append(int(s.strip_edges()))
		elif arg.begins_with("--out="):
			_out_path = arg.substr(6)

	# Pad missing deltas with 0
	while _score_deltas.size() < _num_clients:
		_score_deltas.append(0)

# ---------------------------------------------------------------------------
# _run : async coroutine that drives the whole simulation
# ---------------------------------------------------------------------------
func _run() -> void:
	# ---- 1. Build subtree structure -----------------------------------------
	#
	# Layout under Main for each peer index i:
	#
	#   PeerRoot_i          <- SceneMultiplayer is attached here
	#   ├── Players         <- MultiplayerSpawner.spawn_path targets this
	#   └── Spawner         <- MultiplayerSpawner node
	#
	for i in range(1 + _num_clients):  # index 0 = server, 1..N = clients
		var root: Node = Node.new()
		root.name = "PeerRoot_%d" % i
		add_child(root)

		var players_node: Node = Node.new()
		players_node.name = "Players"
		root.add_child(players_node)

		var spawner: MultiplayerSpawner = MultiplayerSpawner.new()
		spawner.name = "Spawner"
		# spawn_path is resolved via get_node() on the spawner; "../Players"
		# navigates from PeerRoot_i/Spawner up to PeerRoot_i then into Players.
		spawner.spawn_path = NodePath("../Players")
		spawner.add_spawnable_scene("res://player.tscn")
		root.add_child(spawner)

		_roots.append(root)
		_spawners.append(spawner)
		_score_sent.append(false)

	# ---- 2. Create and attach SceneMultiplayer instances --------------------
	for i in range(1 + _num_clients):
		var api: SceneMultiplayer = SceneMultiplayer.new()
		_apis.append(api)
		get_tree().set_multiplayer(api, _roots[i].get_path())

	# ---- 3. Create ENet peers and connect them ------------------------------
	# Server
	var server_enet: ENetMultiplayerPeer = ENetMultiplayerPeer.new()
	var err: int = server_enet.create_server(_port, _num_clients + 1)
	if err != OK:
		push_error("Failed to create ENet server on port %d: %d" % [_port, err])
		get_tree().quit(1)
		return
	_apis[0].multiplayer_peer = server_enet
	_enets.append(server_enet)

	# Clients (stagger creation slightly via deferred pumping so server is ready)
	await get_tree().process_frame
	await get_tree().process_frame

	for i in range(_num_clients):
		var client_enet: ENetMultiplayerPeer = ENetMultiplayerPeer.new()
		err = client_enet.create_client("127.0.0.1", _port)
		if err != OK:
			push_error("Client %d failed to connect: %d" % [i, err])
			get_tree().quit(1)
			return
		_apis[1 + i].multiplayer_peer = client_enet
		_enets.append(client_enet)

	# ---- 4. Wait for all clients to be connected (seen by the server) -------
	var wait_frames: int = 0
	while _apis[0].get_peers().size() < _num_clients:
		await get_tree().process_frame
		wait_frames += 1
		if wait_frames > 2000:
			push_error("Timeout waiting for clients to connect.")
			get_tree().quit(1)
			return

	# ---- 5. Server spawns a Player for itself and for every connected peer --
	_player_scene = load("res://player.tscn")
	if _player_scene == null:
		push_error("Cannot load res://player.tscn")
		get_tree().quit(1)
		return

	# Spawn the host's own player (authority = 1)
	_server_spawn_player(1)

	# Spawn one player per connected client
	for peer_id in _apis[0].get_peers():
		_server_spawn_player(peer_id)

	# ---- 6. Pump frames, send score RPCs from clients once their player
	#         appears, then let synchronisation settle -------------------------
	for _f in range(_num_frames):
		await get_tree().process_frame
		_try_send_score_rpcs()

	# Extra pump to flush any remaining replication packets
	for _f in range(60):
		await get_tree().process_frame

	# ---- 7. Write final-state JSON and exit ---------------------------------
	_write_json()
	get_tree().quit(0)

# ---------------------------------------------------------------------------
# Server-side helper: spawn a Player owned by peer_id
# ---------------------------------------------------------------------------
func _server_spawn_player(peer_id: int) -> void:
	# Instantiate from the packed scene and add to the server's Players node.
	# MultiplayerSpawner detects the child addition (Auto Spawn List mode) and
	# broadcasts the spawn packet to all connected peers automatically — no
	# spawn_function required.
	var player: Node2D = _player_scene.instantiate()
	# Name must be set BEFORE add_child so _enter_tree in player.gd can read
	# the name and call set_multiplayer_authority() with the correct peer ID,
	# which satisfies the MultiplayerSynchronizer registration requirement.
	player.name = str(peer_id)

	# Add to the server's Players container (index 0).
	# player.gd's _enter_tree() sets the multiplayer authority from the name.
	_roots[0].get_node("Players").add_child(player)

	# Position = (peer_id, peer_id) as required by the spec.
	player.position = Vector2(peer_id, peer_id)

# ---------------------------------------------------------------------------
# Called every frame: for each client that has not yet sent its score RPC,
# check if its player node has appeared in that client's subtree.
# Also sets position on the authoritative peer (the client itself) so the
# MultiplayerSynchronizer can replicate it to everyone else.
# ---------------------------------------------------------------------------
func _try_send_score_rpcs() -> void:
	for i in range(_num_clients):
		if _score_sent[i]:
			continue
		var client_index: int = 1 + i         # peer index in our arrays
		var client_api: SceneMultiplayer = _apis[client_index]
		var my_id: int = client_api.get_unique_id()
		if my_id <= 1:
			# Not connected yet / still negotiating
			continue
		# Look for the client's own player in the client's Players node.
		# The node is authoritative here (authority == my_id), so position
		# writes here are what the MultiplayerSynchronizer replicates.
		var players_node: Node = _roots[client_index].get_node("Players")
		var player: Node = null
		for child in players_node.get_children():
			if String(child.name) == str(my_id):
				player = child
				break
		if player == null:
			continue

		# Set authoritative position on the client's own copy.
		# The MultiplayerSynchronizer replicates this to all other peers.
		player.position = Vector2(my_id, my_id)

		# Fire the score RPC.  Because the node lives under _roots[client_index]
		# and SceneTree.set_multiplayer() routes that subtree through client_api,
		# the RPC is sent from the correct ENet peer.
		var delta: int = _score_deltas[i]
		player.update_score.rpc(delta)
		_score_sent[i] = true

# ---------------------------------------------------------------------------
# Snapshot helper: collect state for one peer (by peer array index)
# ---------------------------------------------------------------------------
func _snapshot_peer(peer_index: int) -> Dictionary:
	var api: SceneMultiplayer = _apis[peer_index]
	var uid: int = api.get_unique_id()

	# peers list: everyone this peer knows about (sorted ascending)
	var raw_peers: Array = api.get_peers()
	var peers_sorted: Array = raw_peers.duplicate()
	peers_sorted.sort()

	# players map: iterate the Players container for this peer's subtree
	var players_node: Node = _roots[peer_index].get_node("Players")
	var players_dict: Dictionary = {}
	for child in players_node.get_children():
		# child.name is a StringName; convert to String first, then to int.
		var pid: int = int(String(child.name))
		var pos: Vector2 = child.position
		var sc: int = child.score
		var auth: int = child.get_multiplayer_authority()
		players_dict[str(pid)] = {
			"authority": auth,
			"position": [pos.x, pos.y],
			"score": sc
		}

	return {
		"unique_id": uid,
		"peers": peers_sorted,
		"players": players_dict
	}

# ---------------------------------------------------------------------------
# Write the final-state JSON to _out_path
# ---------------------------------------------------------------------------
func _write_json() -> void:
	var server_snap: Dictionary = _snapshot_peer(0)

	var clients_snap: Array = []
	for i in range(_num_clients):
		clients_snap.append(_snapshot_peer(1 + i))

	var result: Dictionary = {
		"server": server_snap,
		"clients": clients_snap
	}

	var json_text: String = JSON.stringify(result, "\t")
	var f: FileAccess = FileAccess.open(_out_path, FileAccess.WRITE)
	if f == null:
		push_error("Cannot open output file: %s" % _out_path)
		return
	f.store_string(json_text)
	f.close()
	print("Written final state to: ", _out_path)
