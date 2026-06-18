extends Node

var port: int = 0
var clients_count: int = 0
var frames: int = 0
var score_deltas: Array = []
var out_path: String = ""

var server_node: Node
var client_nodes: Array = []

func _ready():
	var args = OS.get_cmdline_user_args()
	for arg in args:
		if arg.begins_with("--port="):
			port = arg.trim_prefix("--port=").to_int()
		elif arg.begins_with("--clients="):
			clients_count = arg.trim_prefix("--clients=").to_int()
		elif arg.begins_with("--frames="):
			frames = arg.trim_prefix("--frames=").to_int()
		elif arg.begins_with("--score-deltas="):
			var deltas_str = arg.trim_prefix("--score-deltas=")
			for d in deltas_str.split(","):
				score_deltas.append(d.to_int())
		elif arg.begins_with("--out="):
			out_path = arg.trim_prefix("--out=")
			
	run_test()

func run_test():
	server_node = create_peer_node("Server")
	
	var server_peer = ENetMultiplayerPeer.new()
	server_peer.create_server(port, clients_count)
	server_node.get_multiplayer().multiplayer_peer = server_peer
	server_node.get_multiplayer().peer_connected.connect(_on_server_peer_connected)
	
	_spawn_player(server_node, 1)
	
	for i in range(clients_count):
		var client_node = create_peer_node("Client_%d" % i)
		client_nodes.append(client_node)
		
		var client_peer = ENetMultiplayerPeer.new()
		client_peer.create_client("127.0.0.1", port)
		client_node.get_multiplayer().multiplayer_peer = client_peer
		
	for f in range(frames):
		await get_tree().process_frame
		
		# Wait until half the frames have passed to ensure all clients are connected and spawned
		if f == int(frames / 2):
			for i in range(clients_count):
				var client_node = client_nodes[i]
				var client_id = client_node.get_multiplayer().get_unique_id()
				if client_id != 0:
					var players_node = client_node.get_node("Players")
					var player_name = str(client_id)
					if players_node.has_node(player_name):
						var player = players_node.get_node(player_name)
						player.update_score.rpc(score_deltas[i])
						
	write_output()
	get_tree().quit()

func create_peer_node(peer_name: String) -> Node:
	var root = Node.new()
	root.name = peer_name
	add_child(root)
	
	var mapi = SceneMultiplayer.new()
	get_tree().set_multiplayer(mapi, root.get_path())
	
	var players = Node.new()
	players.name = "Players"
	root.add_child(players)
	
	var spawner = MultiplayerSpawner.new()
	spawner.name = "MultiplayerSpawner"
	spawner.add_spawnable_scene("res://player.tscn")
	spawner.spawn_path = NodePath("../Players")
	root.add_child(spawner)
	
	return root

func _on_server_peer_connected(id: int):
	_spawn_player(server_node, id)

func _spawn_player(peer_node: Node, id: int):
	var players = peer_node.get_node("Players")
	var player_scene = load("res://player.tscn")
	var player = player_scene.instantiate()
	player.name = str(id)
	players.add_child(player, true)

func write_output():
	var result = {
		"server": get_peer_state(server_node),
		"clients": []
	}
	for client_node in client_nodes:
		result["clients"].append(get_peer_state(client_node))
		
	var f = FileAccess.open(out_path, FileAccess.WRITE)
	f.store_string(JSON.stringify(result, "  "))
	f.close()

func get_peer_state(peer_node: Node) -> Dictionary:
	var mapi = peer_node.get_multiplayer()
	var unique_id = mapi.get_unique_id()
	
	var peers = mapi.get_peers()
	peers.sort()
	
	var players_dict = {}
	var players_node = peer_node.get_node("Players")
	for child in players_node.get_children():
		players_dict[child.name] = {
			"authority": child.get_multiplayer_authority(),
			"position": [child.position.x, child.position.y],
			"score": child.score
		}
		
	return {
		"unique_id": unique_id,
		"peers": peers,
		"players": players_dict
	}
