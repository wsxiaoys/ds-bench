extends SceneTree

func _init():
	var body = RigidBody2D.new()
	# Let's check if total_gravity property is writable on PhysicsDirectBodyState2D.
	# Actually, we can check its property list or try to set it in a test.
	# But we can also check if state.total_gravity is read-only.
	# In Godot 4, PhysicsDirectBodyState2D.total_gravity is read-only.
	# Let's write a test script to check if we can write to it or if it's read-only.
	quit()
