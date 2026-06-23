extends CharacterBody2D

@export var stats: EnemyStats

var current_health: int = 0

func _ready() -> void:
	if stats == null:
		return
	current_health = stats.max_health
	var rect := $ColorRect as ColorRect
	if rect != null:
		rect.color = stats.color


func take_damage(amount: int) -> void:
	current_health -= amount
	if current_health <= 0:
		queue_free()
