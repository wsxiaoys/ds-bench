extends Node2D

@export var enemy_types: Array[EnemyStats]

const EnemyScene = preload("res://scenes/Enemy.tscn")

func _ready():
	var i := 0
	for stat in enemy_types:
		var enemy = EnemyScene.instantiate()
		enemy.stats = stat
		enemy.position = Vector2(i * 100.0, 0.0)
		add_child(enemy)
		i += 1

func take_damage_all(amount: int):
	for child in get_children():
		if child.has_method("take_damage"):
			child.take_damage(amount)