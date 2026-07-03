extends CharacterBody2D
class_name Enemy

@export var stats: EnemyStats

var current_health: int = 0

@onready var color_rect: ColorRect = $ColorRect

func _ready() -> void:
    if stats == null:
        current_health = 100
        return
    current_health = stats.max_health
    if color_rect:
        color_rect.color = stats.color

func take_damage(amount: int) -> void:
    current_health -= amount
    if current_health <= 0:
        queue_free()
