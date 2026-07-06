extends SceneTree
## Standalone test that mimics the verifier:
## loads Animator.tscn, calls play_sequence(), pauses the tween,
## advances with custom_step(0.01), and checks every checkpoint.

const EPS := 0.01

var step_a := 0
var step_b := 0
var step_c := 0
var done := 0

func _init() -> void:
	var scene: PackedScene = load("res://scenes/Animator.tscn")
	var root: Node2D = scene.instantiate()
	root.name = "AnimatorRoot"
	get_root().add_child(root)

	var ctrl: Node = root.get_node("TweenController")
	var target: Node2D = root.get_node("Target")

	# --- connect signals to count occurrences
	ctrl.step_a_complete.connect(func(): step_a += 1)
	ctrl.step_b_complete.connect(func(): step_b += 1)
	ctrl.step_c_complete.connect(func(): step_c += 1)
	ctrl.animation_complete.connect(func(): done += 1)

	# --- verify initial state
	print("=== Initial state ===")
	_check(target, Vector2.ZERO, 0.0, Vector2.ONE, Color(1, 1, 1, 1), 0, 0, 0, 0, "init")

	# --- build tween and pause immediately
	var tween: Tween = ctrl.play_sequence()
	tween.pause()

	# --- drive with custom_step(0.01)
	const STEP := 0.01
	var checkpoints := {
		50: "t=0.50",   # position ≈ (100,50)
		100: "t=1.00",  # position = (200,100), step_a
		150: "t=1.50",  # scale ≈ (1.5,1.5), modulate.a ≈ 0.75
		200: "t=2.00",  # scale = (2,2), modulate.a = 0.5, step_b
		300: "t=3.00",  # rotation = PI/2, step_c
		350: "t=3.50",  # modulate = (0.5,1,1,1), animation_complete
	}

	var max_steps := 400
	for i in range(1, max_steps + 1):
		tween.custom_step(STEP)
		if checkpoints.has(i):
			var label: String = checkpoints[i]
			print("\n=== Checkpoint %s (step %d) ===" % [label, i])
			match i:
				50:
					_check(target, Vector2(100, 50), 0.0, Vector2.ONE,
						Color(1, 1, 1, 1), 0, 0, 0, 0, label)
				100:
					_check(target, Vector2(200, 100), 0.0, Vector2.ONE,
						Color(1, 1, 1, 1), 1, 0, 0, 0, label)
				150:
					_check(target, Vector2(200, 100), 0.0, Vector2(1.5, 1.5),
						Color(1, 1, 1, 0.75), 1, 0, 0, 0, label)
				200:
					_check(target, Vector2(200, 100), 0.0, Vector2(2, 2),
						Color(1, 1, 1, 0.5), 1, 1, 0, 0, label)
				300:
					_check(target, Vector2(200, 100), PI * 0.5, Vector2(2, 2),
						Color(1, 1, 1, 0.5), 1, 1, 1, 0, label)
				350:
					_check(target, Vector2(200, 100), PI * 0.5, Vector2(2, 2),
						Color(0.5, 1, 1, 1), 1, 1, 1, 1, label)
					var running: bool = ctrl.is_running()
					print("  is_running() = %s (expected false)" % running)
					if running:
						print("  ❌ FAIL: is_running() should be false")

	print("\n=== Test complete ===")
	quit()

func _check(target: Node2D, exp_pos: Vector2, exp_rot: float,
		exp_scale: Vector2, exp_mod: Color,
		a: int, b: int, c: int, d: int, label: String) -> void:
	var ok := true
	if not _veq(target.position, exp_pos, EPS):
		print("  ❌ position %s != %s" % [target.position, exp_pos]); ok = false
	if abs(target.rotation - exp_rot) > EPS:
		print("  ❌ rotation %.4f != %.4f" % [target.rotation, exp_rot]); ok = false
	if not _veq(target.scale, exp_scale, EPS):
		print("  ❌ scale %s != %s" % [target.scale, exp_scale]); ok = false
	if not _ceq(target.modulate, exp_mod, EPS):
		print("  ❌ modulate %s != %s" % [target.modulate, exp_mod]); ok = false
	if step_a != a:
		print("  ❌ step_a=%d (expected %d)" % [step_a, a]); ok = false
	if step_b != b:
		print("  ❌ step_b=%d (expected %d)" % [step_b, b]); ok = false
	if step_c != c:
		print("  ❌ step_c=%d (expected %d)" % [step_c, c]); ok = false
	if done != d:
		print("  ❌ done=%d (expected %d)" % [done, d]); ok = false
	if ok:
		print("  ✅ PASS: %s" % label)

func _veq(a: Vector2, b: Vector2, eps: float) -> bool:
	return abs(a.x - b.x) < eps and abs(a.y - b.y) < eps

func _ceq(a: Color, b: Color, eps: float) -> bool:
	return abs(a.r - b.r) < eps and abs(a.g - b.g) < eps and \
		abs(a.b - b.b) < eps and abs(a.a - b.a) < eps