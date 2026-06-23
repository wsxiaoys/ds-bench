extends Node2D

@export var enemy_types: Array[EnemyStats] = []
var enemy_scene: PackedScene = preload("res://scenes/Enemy.tscn")

func _ready():
	var i = 0
	for stats in enemy_types:
		if stats:
			var enemy = enemy_scene.instantiate()
			enemy.stats = stats
			enemy.position = Vector2(i * 50, 0)
			add_child(enemy)
			i += 1

func take_damage_all(amount: int):
	for child in get_children():
		if child.has_method("take_damage"):
			child.take_damage(amount)
