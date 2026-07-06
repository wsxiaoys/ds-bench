extends CharacterBody2D

const SPEED := 200.0

func _physics_process(_delta: float) -> void:
	var x_axis := Input.get_axis("ui_left", "ui_right")
	var y_axis := Input.get_axis("ui_up", "ui_down")
	velocity.x = x_axis * SPEED
	velocity.y = y_axis * SPEED
	move_and_slide()
