extends Node2D

@export var enemy_types: Array[EnemyStats] = []

const ENEMY_SCENE := preload("res://scenes/Enemy.tscn")

func _ready() -> void:
	for i in enemy_types.size():
		var enemy: CharacterBody2D = ENEMY_SCENE.instantiate()
		enemy.stats = enemy_types[i]
		enemy.position = Vector2(i * 64.0, 0.0)
		add_child(enemy)


func take_damage_all(amount: int) -> void:
	for child in get_children():
		if child.has_method("take_damage"):
			child.take_damage(amount)
