extends CharacterBody2D
class_name Enemy

@export var stats: EnemyStats

var current_health: int


func _ready() -> void:
	if stats:
		current_health = stats.max_health
		_apply_color()


func _apply_color() -> void:
	var color_rect := $ColorRect as ColorRect
	if color_rect:
		color_rect.color = stats.color


func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		queue_free()