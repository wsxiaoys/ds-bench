extends CharacterBody2D

const SPEED := 200.0

func _physics_process(_delta: float) -> void:
	var direction_x := Input.get_axis("ui_left", "ui_right")
	var direction_y := Input.get_axis("ui_up", "ui_down")
	velocity = Vector2(direction_x, direction_y).normalized() * SPEED
	move_and_slide()
