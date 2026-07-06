extends CharacterBody2D
class_name Enemy

@export var stats: EnemyStats

var current_health: int = 0

@onready var sprite: ColorRect = $ColorRect


func _ready() -> void:
	if stats == null:
		push_warning("Enemy has no stats resource assigned.")
		return
	current_health = stats.max_health
	sprite.color = stats.color


func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		queue_free()