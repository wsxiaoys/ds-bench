extends SceneTree

var sig_a := 0
var sig_b := 0
var sig_c := 0
var sig_done := 0

func _init() -> void:
	var scene: PackedScene = load("res://scenes/Animator.tscn")
	var instance: Node = scene.instantiate()
	root.add_child(instance)

	var controller: Node = instance.get_node("TweenController")

	controller.step_a_complete.connect(_on_step_a)
	controller.step_b_complete.connect(_on_step_b)
	controller.step_c_complete.connect(_on_step_c)
	controller.animation_complete.connect(_on_animation_complete)

	var target: Node2D = instance.get_node("Target")

	# Verify initial state
	assert(target.position == Vector2.ZERO, "Initial position should be (0,0)")
	assert(target.rotation == 0.0, "Initial rotation should be 0")
	assert(target.scale == Vector2.ONE, "Initial scale should be (1,1)")
	assert(target.modulate == Color.WHITE, "Initial modulate should be white")
	print("PASS: Initial state correct")

	# Play the sequence — immediately pause as the verifier does
	var tween: Tween = controller.play_sequence()
	assert(tween != null, "play_sequence should return a Tween")
	assert(tween.is_valid(), "Tween should be valid")
	assert(controller.is_running(), "Should be running after play_sequence")

	tween.pause()

	print("\n=== Checkpoint t=0.50 ===")
	for i in range(50):
		tween.custom_step(0.01)
	_check_t050(target)

	print("\n=== Checkpoint t=1.00 ===")
	for i in range(50):
		tween.custom_step(0.01)
	_check_t100(target)

	print("\n=== Checkpoint t=1.50 ===")
	for i in range(50):
		tween.custom_step(0.01)
	_check_t150(target)

	print("\n=== Checkpoint t=2.00 ===")
	for i in range(50):
		tween.custom_step(0.01)
	_check_t200(target)

	print("\n=== Checkpoint t=3.00 ===")
	for i in range(100):
		tween.custom_step(0.01)
	_check_t300(target)

	print("\n=== Checkpoint t=3.50 ===")
	for i in range(50):
		tween.custom_step(0.01)
	_check_t350(target)

	print("\n=== Final checks ===")
	print("is_running() = ", controller.is_running(), " (expected false)")
	assert(not controller.is_running(), "Should not be running after animation_complete")
	assert(sig_a == 1, "step_a_complete should fire exactly once, got %d" % sig_a)
	assert(sig_b == 1, "step_b_complete should fire exactly once, got %d" % sig_b)
	assert(sig_c == 1, "step_c_complete should fire exactly once, got %d" % sig_c)
	assert(sig_done == 1, "animation_complete should fire exactly once, got %d" % sig_done)
	print("ALL CHECKS PASSED")

	quit(0)


func _on_step_a() -> void:
	sig_a += 1

func _on_step_b() -> void:
	sig_b += 1

func _on_step_c() -> void:
	sig_c += 1

func _on_animation_complete() -> void:
	sig_done += 1


func _check_t050(target: Node2D) -> void:
	var pos := target.position
	print("  position=(%.4f, %.4f)  expected≈(100, 50)" % [pos.x, pos.y])
	assert(is_equal_approx(pos.x, 100.0) and is_equal_approx(pos.y, 50.0),
		"t=0.50 position mismatch: (%.4f, %.4f)" % [pos.x, pos.y])
	print("  signals a=%d b=%d c=%d done=%d  expected a=0 b=0 c=0 done=0" % [sig_a, sig_b, sig_c, sig_done])
	assert(sig_a == 0 and sig_b == 0 and sig_c == 0 and sig_done == 0, "t=0.50 signal mismatch")

func _check_t100(target: Node2D) -> void:
	var pos := target.position
	print("  position=(%.4f, %.4f)  expected=(200, 100)" % [pos.x, pos.y])
	assert(is_equal_approx(pos.x, 200.0) and is_equal_approx(pos.y, 100.0),
		"t=1.00 position mismatch: (%.4f, %.4f)" % [pos.x, pos.y])
	print("  signals a=%d b=%d c=%d done=%d  expected a=1 b=0 c=0 done=0" % [sig_a, sig_b, sig_c, sig_done])
	assert(sig_a == 1 and sig_b == 0 and sig_c == 0 and sig_done == 0, "t=1.00 signal mismatch")

func _check_t150(target: Node2D) -> void:
	var scl := target.scale
	var ma := target.modulate.a
	print("  scale=(%.4f, %.4f)  expected≈(1.5, 1.5)" % [scl.x, scl.y])
	print("  modulate.a=%.4f  expected≈0.75" % ma)
	assert(is_equal_approx(scl.x, 1.5) and is_equal_approx(scl.y, 1.5),
		"t=1.50 scale mismatch: (%.4f, %.4f)" % [scl.x, scl.y])
	assert(is_equal_approx(ma, 0.75), "t=1.50 modulate.a mismatch: %.4f" % ma)
	print("  signals a=%d b=%d c=%d done=%d  expected a=1 b=0 c=0 done=0" % [sig_a, sig_b, sig_c, sig_done])
	assert(sig_a == 1 and sig_b == 0 and sig_c == 0 and sig_done == 0, "t=1.50 signal mismatch")

func _check_t200(target: Node2D) -> void:
	var scl := target.scale
	var ma := target.modulate.a
	print("  scale=(%.4f, %.4f)  expected=(2, 2)" % [scl.x, scl.y])
	print("  modulate.a=%.4f  expected=0.5" % ma)
	assert(is_equal_approx(scl.x, 2.0) and is_equal_approx(scl.y, 2.0),
		"t=2.00 scale mismatch: (%.4f, %.4f)" % [scl.x, scl.y])
	assert(is_equal_approx(ma, 0.5), "t=2.00 modulate.a mismatch: %.4f" % ma)
	print("  signals a=%d b=%d c=%d done=%d  expected a=1 b=1 c=0 done=0" % [sig_a, sig_b, sig_c, sig_done])
	assert(sig_a == 1 and sig_b == 1 and sig_c == 0 and sig_done == 0, "t=2.00 signal mismatch")

func _check_t300(target: Node2D) -> void:
	var rot := target.rotation
	print("  rotation=%.6f  expected=PI/2=%.6f" % [rot, PI / 2.0])
	assert(is_equal_approx(rot, PI / 2.0), "t=3.00 rotation mismatch: %.6f" % rot)
	print("  signals a=%d b=%d c=%d done=%d  expected a=1 b=1 c=1 done=0" % [sig_a, sig_b, sig_c, sig_done])
	assert(sig_a == 1 and sig_b == 1 and sig_c == 1 and sig_done == 0, "t=3.00 signal mismatch")

func _check_t350(target: Node2D) -> void:
	var mod := target.modulate
	print("  modulate=(%.4f, %.4f, %.4f, %.4f)  expected=(0.5, 1.0, 1.0, 1.0)" % [mod.r, mod.g, mod.b, mod.a])
	assert(is_equal_approx(mod.r, 0.5) and is_equal_approx(mod.g, 1.0) and is_equal_approx(mod.b, 1.0) and is_equal_approx(mod.a, 1.0),
		"t=3.50 modulate mismatch: (%.4f, %.4f, %.4f, %.4f)" % [mod.r, mod.g, mod.b, mod.a])
	print("  signals a=%d b=%d c=%d done=%d  expected a=1 b=1 c=1 done=1" % [sig_a, sig_b, sig_c, sig_done])
	assert(sig_a == 1 and sig_b == 1 and sig_c == 1 and sig_done == 1, "t=3.50 signal mismatch")
