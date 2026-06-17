extends Node

var port: int = 12345
var clients_count: int = 1
var frames_count: int = 10
var score_deltas: Array[int] = []
var out_path: String = ""

var server_root: Node
var server_api: SceneMultiplayer
var server_players_container: Node2D

var client_roots: Array[Node] = []
var client_apis: Array[SceneMultiplayer] = []
var client_players_containers: Array[Node2D] = []

var player_scene = preload("res://player.tscn")

func _ready() -> void:
	parse_args()
	setup_server()
	
	# Spawn server's own player
	spawn_player(1)
	
	setup_clients()
	
	# Pump frames
	for f in range(frames_count):
		await get_tree().process_frame
	
	# Gather final state and write JSON
	write_output()
	
	# Quit process
	get_tree().quit()

func parse_args() -> void:
	var args = OS.get_cmdline_user_args()
	print("User arguments: ", args)
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
				for part in csv.split(","):
					score_deltas.append(part.to_int())
		elif arg.begins_with("--out="):
			out_path = arg.split("=")[1]
	
	print("Parsed Config:")
	print("  port: ", port)
	print("  clients_count: ", clients_count)
	print("  frames_count: ", frames_count)
	print("  score_deltas: ", score_deltas)
	print("  out_path: ", out_path)

func setup_server() -> void:
	server_root = Node.new()
	server_root.name = "Server"
	add_child(server_root)
	
	server_api = SceneMultiplayer.new()
	get_tree().set_multiplayer(server_api, server_root.get_path())
	
	server_players_container = Node2D.new()
	server_players_container.name = "Players"
	server_root.add_child(server_players_container)
	
	var spawner = MultiplayerSpawner.new()
	spawner.name = "MultiplayerSpawner"
	spawner.spawn_path = NodePath("../Players")
	spawner.add_spawnable_scene("res://player.tscn")
	server_root.add_child(spawner)
	
	var peer = ENetMultiplayerPeer.new()
	var err = peer.create_server(port, clients_count + 1)
	if err != OK:
		printerr("Server failed to create ENet server: ", err)
		return
	server_api.multiplayer_peer = peer
	
	server_api.peer_connected.connect(_on_server_peer_connected)
	server_api.peer_disconnected.connect(_on_server_peer_disconnected)
	
	print("Server initialized on port ", port)

func spawn_player(peer_id: int) -> void:
	var player = player_scene.instantiate()
	player.name = str(peer_id)
	server_players_container.add_child(player)
	print("Server spawned player for peer: ", peer_id)

func _on_server_peer_connected(peer_id: int) -> void:
	print("Server: Peer connected: ", peer_id)
	spawn_player(peer_id)

func _on_server_peer_disconnected(peer_id: int) -> void:
	print("Server: Peer disconnected: ", peer_id)
	var player = server_players_container.get_node_or_null(str(peer_id))
	if player:
		player.queue_free()

func setup_clients() -> void:
	for i in range(clients_count):
		var client_root = Node.new()
		client_root.name = "Client_" + str(i)
		client_root.set_meta("client_index", i)
		add_child(client_root)
		client_roots.append(client_root)
		
		var client_api = SceneMultiplayer.new()
		get_tree().set_multiplayer(client_api, client_root.get_path())
		client_apis.append(client_api)
		
		var client_players_container = Node2D.new()
		client_players_container.name = "Players"
		client_root.add_child(client_players_container)
		client_players_containers.append(client_players_container)
		
		var spawner = MultiplayerSpawner.new()
		spawner.name = "MultiplayerSpawner"
		spawner.spawn_path = NodePath("../Players")
		spawner.add_spawnable_scene("res://player.tscn")
		client_root.add_child(spawner)
		
		spawner.spawned.connect(func(node: Node):
			if node.get_multiplayer_authority() == client_api.get_unique_id():
				var idx = client_root.get_meta("client_index")
				var delta_val = 0
				if idx < score_deltas.size():
					delta_val = score_deltas[idx]
				print("Client ", idx, " (peer ", client_api.get_unique_id(), ") observed own spawn, sending score delta: ", delta_val)
				node.update_score.rpc(delta_val)
		)
		
		var peer = ENetMultiplayerPeer.new()
		var err = peer.create_client("127.0.0.1", port)
		if err != OK:
			printerr("Client ", i, " failed to create ENet client: ", err)
			continue
		client_api.multiplayer_peer = peer
		
		print("Client ", i, " initialized and connecting to port ", port)

func gather_server_state() -> Dictionary:
	var state = {}
	state["unique_id"] = 1
	
	var peers_list = []
	for p in server_api.get_peers():
		peers_list.append(p)
	peers_list.sort()
	state["peers"] = peers_list
	
	var players_dict = {}
	for player in server_players_container.get_children():
		var peer_id = player.name.to_int()
		players_dict[str(peer_id)] = {
			"authority": player.get_multiplayer_authority(),
			"position": [player.position.x, player.position.y],
			"score": player.score
		}
	state["players"] = players_dict
	return state

func gather_client_state(i: int, client_root: Node, client_api: MultiplayerAPI) -> Dictionary:
	var state = {}
	var unique_id = client_api.get_unique_id()
	state["unique_id"] = unique_id
	
	var peers_list = []
	for p in client_api.get_peers():
		peers_list.append(p)
	peers_list.sort()
	state["peers"] = peers_list
	
	var players_dict = {}
	var players_node = client_root.get_node("Players")
	for player in players_node.get_children():
		var peer_id = player.name.to_int()
		players_dict[str(peer_id)] = {
			"authority": player.get_multiplayer_authority(),
			"position": [player.position.x, player.position.y],
			"score": player.score
		}
	state["players"] = players_dict
	return state

func write_output() -> void:
	if out_path == "":
		print("No output path specified, skipping JSON write.")
		return
		
	var final_state = {
		"server": gather_server_state(),
		"clients": []
	}
	
	for i in range(clients_count):
		var client_root = client_roots[i]
		var client_api = client_apis[i]
		final_state["clients"].append(gather_client_state(i, client_root, client_api))
		
	var json_string = JSON.stringify(final_state, "  ")
	var file = FileAccess.open(out_path, FileAccess.WRITE)
	if file:
		file.store_string(json_string)
		file.close()
		print("Successfully wrote final state to: ", out_path)
	else:
		printerr("Failed to open output path for writing: ", out_path)
