extends Node

@export var enemy_types: Array[EnemyStats] = []

var _spawned_enemies: Array[Node] = []

func _ready() -> void:
	var enemy_scene := preload("res://scenes/Enemy.tscn")
	var spacing := 64.0
	for i in enemy_types.size():
		var enemy: CharacterBody2D = enemy_scene.instantiate()
		enemy.stats = enemy_types[i]
		enemy.position = Vector2(i * spacing, 0)
		add_child(enemy)
		_spawned_enemies.append(enemy)

func take_damage_all(amount: int) -> void:
	for enemy in _spawned_enemies:
		if is_instance_valid(enemy):
			enemy.take_damage(amount)
