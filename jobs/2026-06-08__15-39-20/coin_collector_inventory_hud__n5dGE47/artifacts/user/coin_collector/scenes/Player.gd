extends CharacterBody2D

const SPEED = 300.0

func _physics_process(_delta: float) -> void:
    var x = Input.get_axis("ui_left", "ui_right")
    var y = Input.get_axis("ui_up", "ui_down")
    velocity = Vector2(x, y).normalized() * SPEED
    move_and_slide()
