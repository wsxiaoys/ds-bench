extends CharacterBody2D

const SPEED := 300.0


func _physics_process(delta: float) -> void:
	var direction := Vector2(
		Input.get_axis("ui_left", "ui_right"),
		Input.get_axis("ui_up", "ui_down")
	)
	if direction != Vector2.ZERO:
		velocity = direction.normalized() * SPEED
	else:
		velocity = Vector2.ZERO
	move_and_slide()
