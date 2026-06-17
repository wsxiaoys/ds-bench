extends CharacterBody2D

@export var stats: EnemyStats

var current_health: int = 0

func _ready() -> void:
	if stats != null:
		current_health = stats.max_health
		$ColorRect.color = stats.color

func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		queue_free()
