extends Node2D
class_name Spawner

const ENEMY_SCENE: PackedScene = preload("res://scenes/Enemy.tscn")

@export var enemy_types: Array[EnemyStats] = []

var spawned_enemies: Array[Enemy] = []


func _ready() -> void:
	_spawn_enemies()


func _spawn_enemies() -> void:
	var index: int = 0
	for stats in enemy_types:
		if stats == null:
			push_warning("Spawner entry %d has a null EnemyStats resource." % index)
			index += 1
			continue
		var enemy: Enemy = ENEMY_SCENE.instantiate()
		enemy.name = str(stats.name)
		enemy.stats = stats
		enemy.position = Vector2(index * 64.0, 0.0)
		add_child(enemy)
		spawned_enemies.append(enemy)
		index += 1


func take_damage_all(amount: int) -> void:
	for enemy in spawned_enemies:
		if is_instance_valid(enemy):
			enemy.take_damage(amount)