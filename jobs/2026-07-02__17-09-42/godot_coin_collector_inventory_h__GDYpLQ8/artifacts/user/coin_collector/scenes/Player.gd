class_name Player
extends CharacterBody2D

# Player controller. Moves in 4 directions using the standard UI actions and
# uses move_and_slide() inside _physics_process for collision-aware motion.

const SPEED: float = 240.0


func _physics_process(_delta: float) -> void:
	var direction_x: float = Input.get_axis("ui_left", "ui_right")
	var direction_y: float = Input.get_axis("ui_up", "ui_down")
	velocity = Vector2(direction_x, direction_y) * SPEED
	move_and_slide()