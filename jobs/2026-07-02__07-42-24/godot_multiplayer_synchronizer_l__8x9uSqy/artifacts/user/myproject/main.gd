extends Node

const PlayerScene = preload("res://player.tscn")

var port: int = 12345
var clients_count: int = 2
var frames_count: int = 60
var score_deltas: Array[int] = []
var out_path: String = "output.json"

var server_node: Node
var server_players: Node
var server_spawner: MultiplayerSpawner
var server_api: SceneMultiplayer

var client_nodes: Array[Node] = []
var client_players_nodes: Array[Node] = []
var client_spawners: Array[MultiplayerSpawner] = []
var client_apis: Array[SceneMultiplayer] = []

func _ready() -> void:
	parse_arguments()
	setup_server()
	setup_clients()
	run_simulation()

func parse_arguments() -> void:
	var args = OS.get_cmdline_user_args()
	for arg in args:
		if arg.begins_with("--port="):
			port = arg.split("=")[1].to_int()
		elif arg.begins_with("--clients="):
			clients_count = arg.split("=")[1].to_int()
		elif arg.begins_with("--frames="):
			frames_count = arg.split("=")[1].to_int()
		elif arg.begins_with("--score-deltas="):
			var csv = arg.split("=")[1]
			score_deltas.clear()
			if csv != "":
				for val in csv.split(","):
					score_deltas.append(val.to_int())
		elif arg.begins_with("--out="):
			out_path = arg.split("=")[1]

func setup_server() -> void:
	server_node = Node.new()
	server_node.name = "Server"
	add_child(server_node)

	server_players = Node.new()
	server_players.name = "Players"
	server_node.add_child(server_players)

	server_spawner = MultiplayerSpawner.new()
	server_spawner.name = "MultiplayerSpawner"
	server_spawner.spawn_path = "../Players"
	server_spawner.add_spawnable_scene("res://player.tscn")
	server_node.add_child(server_spawner)

	server_api = SceneMultiplayer.new()
	var peer = ENetMultiplayerPeer.new()
	var err = peer.create_server(port, clients_count)
	if err != OK:
		printerr("Server creation failed: ", err)
		get_tree().quit(1)
		return
	server_api.multiplayer_peer = peer
	get_tree().set_multiplayer(server_api, server_node.get_path())

	# Connect signals
	server_api.peer_connected.connect(_on_server_peer_connected)
	server_api.peer_disconnected.connect(_on_server_peer_disconnected)

	# Spawn server's own player (peer ID 1)
	var server_player = PlayerScene.instantiate()
	server_player.name = "1"
	server_players.add_child(server_player)

func _on_server_peer_connected(id: int) -> void:
	# Spawn player node for the connected client
	var client_player = PlayerScene.instantiate()
	client_player.name = str(id)
	server_players.add_child(client_player)

func _on_server_peer_disconnected(id: int) -> void:
	var player_node = server_players.get_node_or_null(str(id))
	if player_node:
		player_node.queue_free()

func setup_clients() -> void:
	for i in range(clients_count):
		var client_node = Node.new()
		client_node.name = "Client_" + str(i)
		add_child(client_node)
		client_nodes.append(client_node)

		var client_players = Node.new()
		client_players.name = "Players"
		client_node.add_child(client_players)
		client_players_nodes.append(client_players)

		var client_spawner = MultiplayerSpawner.new()
		client_spawner.name = "MultiplayerSpawner"
		client_spawner.spawn_path = "../Players"
		client_spawner.add_spawnable_scene("res://player.tscn")
		client_node.add_child(client_spawner)
		client_spawners.append(client_spawner)

		var client_api = SceneMultiplayer.new()
		var peer = ENetMultiplayerPeer.new()
		var err = peer.create_client("127.0.0.1", port)
		if err != OK:
			printerr("Client ", i, " creation failed: ", err)
			get_tree().quit(1)
			return
		client_api.multiplayer_peer = peer
		get_tree().set_multiplayer(client_api, client_node.get_path())
		client_apis.append(client_api)

		# Store the index on the container so the child_entered_tree signal can access it
		client_players.set_meta("client_index", i)
		client_players.child_entered_tree.connect(_on_client_player_entered.bind(client_players, client_api))

func _on_client_player_entered(node: Node, client_players: Node, client_api: SceneMultiplayer) -> void:
	if client_players.get_child_count() == clients_count + 1:
		if not client_players.has_meta("has_called_rpc"):
			client_players.set_meta("has_called_rpc", true)
			var client_id = client_api.get_unique_id()
			var my_player = client_players.get_node_or_null(str(client_id))
			if my_player:
				var client_index = client_players.get_meta("client_index")
				var delta = 0
				if client_index < score_deltas.size():
					delta = score_deltas[client_index]
				# Send RPC to update score
				my_player.update_score.rpc(delta)

func run_simulation() -> void:
	for f in range(frames_count):
		await get_tree().process_frame
	
	write_final_state()
	get_tree().quit(0)

func write_final_state() -> void:
	var state = {}

	# Server state
	var server_state = {}
	server_state["unique_id"] = 1
	
	var server_peers = []
	for p in server_api.get_peers():
		server_peers.append(p)
	server_peers.sort()
	server_state["peers"] = server_peers

	var server_players_dict = {}
	for player_node in server_players.get_children():
		var peer_id = player_node.name.to_int()
		server_players_dict[str(peer_id)] = {
			"authority": player_node.get_multiplayer_authority(),
			"position": [player_node.position.x, player_node.position.y],
			"score": player_node.score
		}
	server_state["players"] = server_players_dict
	state["server"] = server_state

	# Clients state
	var clients_state = []
	for i in range(clients_count):
		var client_api = client_apis[i]
		var client_players = client_players_nodes[i]
		
		var client_state = {}
		client_state["unique_id"] = client_api.get_unique_id()
		
		var client_peers = []
		for p in client_api.get_peers():
			client_peers.append(p)
		client_peers.sort()
		client_state["peers"] = client_peers

		var client_players_dict = {}
		for player_node in client_players.get_children():
			var peer_id = player_node.name.to_int()
			client_players_dict[str(peer_id)] = {
				"authority": player_node.get_multiplayer_authority(),
				"position": [player_node.position.x, player_node.position.y],
				"score": player_node.score
			}
		client_state["players"] = client_players_dict
		clients_state.append(client_state)
	
	state["clients"] = clients_state

	# Ensure base directory exists
	var base_dir = out_path.get_base_dir()
	if base_dir != "" and not DirAccess.dir_exists_absolute(base_dir):
		DirAccess.make_dir_recursive_absolute(base_dir)

	# Write to JSON
	var file = FileAccess.open(out_path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(state, "  "))
		file.close()
		print("Successfully wrote final state to ", out_path)
	else:
		printerr("Failed to open output file: ", out_path)
