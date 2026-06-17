extends CharacterBody2D

@export var speed: float = 300.0

func _physics_process(_delta: float) -> void:
	var input_direction := Vector2(
		Input.get_axis("ui_left", "ui_right"),
		Input.get_axis("ui_up", "ui_down")
	)
	
	if input_direction != Vector2.ZERO:
		input_direction = input_direction.normalized()
		
	velocity = input_direction * speed
	move_and_slide()
