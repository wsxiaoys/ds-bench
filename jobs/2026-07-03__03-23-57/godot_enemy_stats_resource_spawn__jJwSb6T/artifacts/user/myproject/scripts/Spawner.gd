extends Node2D
class_name Spawner

@export var enemy_types: Array[EnemyStats] = []

const ENEMY_SCENE = preload("res://scenes/Enemy.tscn")

func _ready() -> void:
	for i in range(enemy_types.size()):
		var stats = enemy_types[i]
		if stats:
			var enemy = ENEMY_SCENE.instantiate()
			enemy.stats = stats
			enemy.position = Vector2(i * 100.0, 0.0)
			add_child(enemy)

func take_damage_all(amount: int) -> void:
	for child in get_children():
		if child.has_method("take_damage"):
			child.take_damage(amount)
