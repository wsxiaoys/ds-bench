class_name Spawner
extends Node2D

@export var enemy_types: Array[EnemyStats] = []

const ENEMY_SCENE = preload("res://scenes/Enemy.tscn")

func _ready() -> void:
	var offset = 0.0
	for stats in enemy_types:
		if stats:
			var enemy = ENEMY_SCENE.instantiate()
			enemy.stats = stats
			enemy.position = Vector2(offset, 0)
			add_child(enemy)
			offset += 100.0

func take_damage_all(amount: int) -> void:
	for child in get_children():
		if child.has_method("take_damage"):
			child.take_damage(amount)
