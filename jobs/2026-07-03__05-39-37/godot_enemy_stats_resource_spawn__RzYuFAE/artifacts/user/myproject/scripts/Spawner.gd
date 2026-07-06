extends Node2D

const EnemyScene := preload("res://scenes/Enemy.tscn")

@export var enemy_types: Array[EnemyStats]

var _spawned_enemies: Array[Enemy] = []


func _ready() -> void:
	spawn_all()


func spawn_all() -> void:
	for i in enemy_types.size():
		var stats: EnemyStats = enemy_types[i]
		var enemy: Enemy = EnemyScene.instantiate()
		enemy.stats = stats
		# Spread enemies horizontally at distinct positions.
		enemy.position = Vector2(i * 100.0, 0.0)
		add_child(enemy)
		_spawned_enemies.append(enemy)


func take_damage_all(amount: int) -> void:
	for enemy in _spawned_enemies:
		if is_instance_valid(enemy):
			enemy.take_damage(amount)