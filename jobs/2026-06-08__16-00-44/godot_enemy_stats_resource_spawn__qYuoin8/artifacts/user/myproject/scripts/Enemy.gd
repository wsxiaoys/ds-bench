extends CharacterBody2D

@export var stats: EnemyStats

var current_health: int

func _ready():
	if stats:
		current_health = stats.max_health
		$ColorRect.color = stats.color

func take_damage(amount: int):
	current_health -= amount
	if current_health <= 0:
		queue_free()