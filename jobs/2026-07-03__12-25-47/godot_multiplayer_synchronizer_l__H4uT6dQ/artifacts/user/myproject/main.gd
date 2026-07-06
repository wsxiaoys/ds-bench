extends Node

const HOST_ROOT: NodePath = NodePath("/root/Main/HostRoot")
const CLIENT_ROOT_PREFIX: String = "/root/Main/ClientRoot_"
const PLAYERS_NODE_NAME: String = "Players"
const SPAWNER_NODE_NAME: String = "Spawner"
const PlayerScene: PackedScene = preload("res://player.tscn")

var server_root: Node = null
var client_roots: Array[Node] = []
var client_multiplayers: Array[MultiplayerAPI] = []
var host_multiplayer: MultiplayerAPI = null

var port: int = 7000
var num_clients: int = 1
var num_frames: int = 30
var score_deltas: Array[int] = []
var out_path: String = ""

var frame_count: int = 0
var all_client_connected: bool = false
var clients_score_sent: Array[bool] = []
var json_written: bool = false

func _ready() -> void:
    _parse_args()
    print("Args: port=%d clients=%d frames=%d deltas=%s out=%s" % [port, num_clients, num_frames, str(score_deltas), out_path])
    _build_scene()
    _start_server()
    _start_clients()
    _run()

func _parse_args() -> void:
    var args: PackedStringArray = OS.get_cmdline_user_args()
    var i: int = 0
    while i < args.size():
        var a: String = args[i]
        if a == "--port" and i + 1 < args.size():
            port = int(args[i + 1])
            i += 2
        elif a == "--clients" and i + 1 < args.size():
            num_clients = int(args[i + 1])
            i += 2
        elif a == "--frames" and i + 1 < args.size():
            num_frames = int(args[i + 1])
            i += 2
        elif a == "--score-deltas" and i + 1 < args.size():
            var parts: PackedStringArray = args[i + 1].split(",")
            for p in parts:
                if p.strip_edges() != "":
                    score_deltas.append(int(p))
            i += 2
        elif a == "--out" and i + 1 < args.size():
            out_path = args[i + 1]
            i += 2
        else:
            i += 1

func _build_scene() -> void:
    server_root = Node.new()
    server_root.name = "HostRoot"
    add_child(server_root)
    var players_h: Node = Node.new()
    players_h.name = PLAYERS_NODE_NAME
    server_root.add_child(players_h)
    var spawner_h: MultiplayerSpawner = MultiplayerSpawner.new()
    spawner_h.name = SPAWNER_NODE_NAME
    spawner_h.spawn_path = NodePath("../" + PLAYERS_NODE_NAME)
    spawner_h.add_spawnable_scene("res://player.tscn")
    server_root.add_child(spawner_h)
    for i in range(num_clients):
        var c_root: Node = Node.new()
        c_root.name = "ClientRoot_" + str(i)
        add_child(c_root)
        var players_c: Node = Node.new()
        players_c.name = PLAYERS_NODE_NAME
        c_root.add_child(players_c)
        var spawner_c: MultiplayerSpawner = MultiplayerSpawner.new()
        spawner_c.name = SPAWNER_NODE_NAME
        spawner_c.spawn_path = NodePath("../" + PLAYERS_NODE_NAME)
        spawner_c.add_spawnable_scene("res://player.tscn")
        c_root.add_child(spawner_c)
        client_roots.append(c_root)
        clients_score_sent.append(false)

func _start_server() -> void:
    host_multiplayer = SceneMultiplayer.new()
    var host_peer: ENetMultiplayerPeer = ENetMultiplayerPeer.new()
    var max_clients: int = max(8, num_clients + 4)
    var err: int = host_peer.create_server(port, max_clients)
    if err != OK:
        push_error("create_server failed err=%d" % err)
    host_multiplayer.multiplayer_peer = host_peer
    get_tree().set_multiplayer(host_multiplayer, HOST_ROOT)
    var spawner: MultiplayerSpawner = server_root.get_node(SPAWNER_NODE_NAME)
    spawner.spawn(PlayerScene)
    var players_node: Node = server_root.get_node(PLAYERS_NODE_NAME)
    var host_player: Node = players_node.get_child(0)
    host_player.name = str(1)
    host_player.set_multiplayer_authority(1, true)
    host_player.position = Vector2(1, 1)

func _start_clients() -> void:
    for i in range(num_clients):
        var mp: SceneMultiplayer = SceneMultiplayer.new()
        var peer: ENetMultiplayerPeer = ENetMultiplayerPeer.new()
        var err: int = peer.create_client("127.0.0.1", port)
        if err != OK:
            push_error("create_client failed err=%d" % err)
        mp.multiplayer_peer = peer
        var path: NodePath = NodePath(CLIENT_ROOT_PREFIX + str(i))
        get_tree().set_multiplayer(mp, path)
        client_multiplayers.append(mp)

func _run() -> void:
    while frame_count < num_frames + 200:
        await get_tree().process_frame
        frame_count += 1
        var all_connected: bool = true
        for i in range(num_clients):
            var mp: MultiplayerAPI = client_multiplayers[i]
            if mp == null or mp.multiplayer_peer == null:
                all_connected = false
                break
            if mp.multiplayer_peer.get_connection_status() != MultiplayerPeer.CONNECTION_CONNECTED:
                all_connected = false
                break
        if not all_connected:
            continue
        if not all_client_connected:
            all_client_connected = true
            print("All clients connected at frame %d" % frame_count)
            var target_frame: int = frame_count + num_frames
            while frame_count < target_frame:
                await get_tree().process_frame
                frame_count += 1
            for i in range(num_clients):
                if clients_score_sent[i]:
                    continue
                var c_root: Node = client_roots[i]
                var mp: MultiplayerAPI = client_multiplayers[i]
                var my_id: int = mp.get_unique_id()
                var players_node: Node = c_root.get_node(PLAYERS_NODE_NAME)
                var my_player: Node = null
                for child in players_node.get_children():
                    if str(child.name) == str(my_id):
                        my_player = child
                        break
                if my_player == null:
                    print("Client %d could not find its player (my_id=%d)" % [i, my_id])
                    continue
                var delta_val: int = 0
                if i < score_deltas.size():
                    delta_val = score_deltas[i]
                print("Client %d (id=%d) sending update_score(%d)" % [i, my_id, delta_val])
                my_player.update_score.rpc(delta_val)
                clients_score_sent[i] = true
            var extra: int = 0
            while extra < 10:
                await get_tree().process_frame
                frame_count += 1
                extra += 1
            _write_json()
            json_written = true
            get_tree().quit()
            return
    if not json_written:
        _write_json()
        get_tree().quit()

func _write_json() -> void:
    var server_data: Dictionary = _collect_state(server_root, host_multiplayer, true)
    var clients_data: Array = []
    for i in range(num_clients):
        var c_data: Dictionary = _collect_state(client_roots[i], client_multiplayers[i], false)
        clients_data.append(c_data)
    var out: Dictionary = {
        "server": server_data,
        "clients": clients_data,
    }
    var f: FileAccess = FileAccess.open(out_path, FileAccess.WRITE)
    if f == null:
        push_error("cannot open out file: %s err=%d" % [out_path, FileAccess.get_open_error()])
        return
    f.store_string(JSON.stringify(out, "\t"))
    f.close()
    print("WROTE: " + out_path)

func _collect_state(root: Node, mp: MultiplayerAPI, is_server: bool) -> Dictionary:
    var unique_id: int = 0
    if mp != null and mp.multiplayer_peer != null:
        unique_id = mp.get_unique_id()
    var peers: Array[int] = []
    if is_server:
        for i in range(num_clients):
            var c_mp: MultiplayerAPI = client_multiplayers[i]
            if c_mp != null and c_mp.multiplayer_peer != null and c_mp.multiplayer_peer.get_connection_status() == MultiplayerPeer.CONNECTION_CONNECTED:
                peers.append(c_mp.get_unique_id())
    else:
        if host_multiplayer != null:
            peers.append(1)
        for i in range(num_clients):
            var c_mp2: MultiplayerAPI = client_multiplayers[i]
            if c_mp2 == null or c_mp2.multiplayer_peer == null:
                continue
            if c_mp2.multiplayer_peer.get_connection_status() != MultiplayerPeer.CONNECTION_CONNECTED:
                continue
            var c_id: int = c_mp2.get_unique_id()
            if c_id != unique_id:
                peers.append(c_id)
    peers.sort()
    var players_dict: Dictionary = {}
    if root != null:
        var players_node: Node = root.get_node_or_null(PLAYERS_NODE_NAME)
        if players_node != null:
            for child in players_node.get_children():
                var key: String = str(child.name)
                var pos: Vector2 = child.position
                var s: int = child.score
                var auth: int = child.get_multiplayer_authority()
                players_dict[key] = {
                    "authority": auth,
                    "position": [pos.x, pos.y],
                    "score": s,
                }
    return {
        "unique_id": unique_id,
        "peers": peers,
        "players": players_dict,
    }
