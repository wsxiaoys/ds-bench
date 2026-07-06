extends Node2D
class_name Spawner

@export var enemy_types: Array[EnemyStats] = []

var spawned_enemies: Array[Enemy] = []

const EnemyScene: PackedScene = preload("res://scenes/Enemy.tscn")

func _ready() -> void:
    var index: int = 0
    for stats in enemy_types:
        var enemy: Enemy = EnemyScene.instantiate()
        enemy.stats = stats
        enemy.position = Vector2(index * 100.0, 0.0)
        add_child(enemy)
        spawned_enemies.append(enemy)
        index += 1

func take_damage_all(amount: int) -> void:
    for enemy in spawned_enemies:
        if is_instance_valid(enemy):
            enemy.take_damage(amount)
