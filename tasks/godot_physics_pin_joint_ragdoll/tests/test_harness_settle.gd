extends Node


const PART_NAMES := [
	"Head", "Torso", "LeftArm", "RightArm", "LeftLeg", "RightLeg",
]

var _collapse_count: int = 0
var _collapse_pos: Vector2 = Vector2.ZERO
var _ragdoll: Node = null


func _ready() -> void:
	# Build a simple world: a static floor + the ragdoll instantiated in the air.
	var floor_body := StaticBody2D.new()
	floor_body.name = "Floor"
	floor_body.position = Vector2(0, 400)
	var floor_shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(2000, 40)
	floor_shape.shape = rect
	floor_body.add_child(floor_shape)
	add_child(floor_body)

	var packed: PackedScene = load("res://scenes/Ragdoll.tscn")
	if packed == null:
		printerr("FAIL: could not load res://scenes/Ragdoll.tscn")
		get_tree().quit(2)
		return

	_ragdoll = packed.instantiate()
	if _ragdoll is Node2D:
		(_ragdoll as Node2D).position = Vector2(0, 0)
	add_child(_ragdoll)
	await get_tree().process_frame

	# Subscribe to the collapse signal.
	if not _ragdoll.has_signal("ragdoll_collapsed"):
		printerr("FAIL: Ragdoll is missing signal 'ragdoll_collapsed'")
		get_tree().quit(3)
		return
	_ragdoll.connect("ragdoll_collapsed", Callable(self, "_on_collapsed"))

	# Track recent average y positions to confirm true settle.
	var recent_avg_y: Array = []
	var last_avg_y: float = 0.0

	# Simulate ~5 seconds of physics so the ragdoll has time to fall + settle.
	var total_frames := 60 * 5
	for i in range(total_frames):
		await get_tree().physics_frame
		var avg: Vector2 = _ragdoll.call("get_average_position")
		recent_avg_y.append(avg.y)
		if recent_avg_y.size() > 30:
			recent_avg_y.pop_front()
		last_avg_y = avg.y

	# Expect exactly one emission.
	if _collapse_count != 1:
		printerr("FAIL: expected ragdoll_collapsed to be emitted exactly once, got %d"
			% _collapse_count)
		get_tree().quit(4)
		return

	# Average vertical movement per frame over the last 30 frames should be small.
	if recent_avg_y.size() >= 2:
		var total_move: float = 0.0
		for j in range(1, recent_avg_y.size()):
			total_move += abs(float(recent_avg_y[j]) - float(recent_avg_y[j - 1]))
		var avg_move := total_move / float(recent_avg_y.size() - 1)
		if avg_move >= 0.5:
			printerr("FAIL: average vertical movement per frame over last 30 frames is %f (>= 0.5)"
				% avg_move)
			get_tree().quit(5)
			return

	# Verify the centroid argument matches get_average_position() at end of sim (approx).
	var final_avg: Vector2 = _ragdoll.call("get_average_position")
	if abs(_collapse_pos.x - final_avg.x) > 5.0 or abs(_collapse_pos.y - final_avg.y) > 5.0:
		printerr("FAIL: emitted avg_pos %s does not match final get_average_position() %s (within 5 px)"
			% [str(_collapse_pos), str(final_avg)])
		get_tree().quit(6)
		return

	print("SETTLE_HARNESS_OK")
	get_tree().quit(0)


func _on_collapsed(avg_pos: Vector2) -> void:
	_collapse_count += 1
	_collapse_pos = avg_pos
