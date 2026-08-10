extends RigidBody2D

var tick_count = 0

func _ready():
	global_position = Vector2(0, 0)
	linear_velocity = Vector2(0, 0)
	angular_velocity = 0.0

func _integrate_forces(state):
	tick_count += 1
	if tick_count == 1:
		var controller = get_parent()
		if controller and controller.has_method("net_gravity_at"):
			var correct_gravity = controller.net_gravity_at(state.transform.origin)
			var dt = state.step
			# Remove the default gravity applied on the first tick and apply the correct gravity
			var default_gravity = Vector2(0, 100)
			state.linear_velocity -= default_gravity * dt
			state.linear_velocity += correct_gravity * dt
