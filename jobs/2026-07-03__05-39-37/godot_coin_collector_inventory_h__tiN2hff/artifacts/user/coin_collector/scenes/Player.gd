extends CharacterBody2D
## Player controlled with the arrow keys via the default ui_* input actions.

const SPEED := 300.0


func _physics_process(_delta: float) -> void:
	var dir_x := Input.get_axis("ui_left", "ui_right")
	var dir_y := Input.get_axis("ui_up", "ui_down")
	velocity = Vector2(dir_x, dir_y) * SPEED
	move_and_slide()