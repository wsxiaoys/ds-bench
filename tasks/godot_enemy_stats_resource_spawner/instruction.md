# Custom Resource-Driven Enemy Spawner (Godot 4)

## Background
In the existing Godot 4 project at `/home/user/myproject`, design a small, data-driven enemy spawning system. Different enemy archetypes (goblin, orc, dragon) are defined entirely as `.tres` resource files that share one custom `Resource` script. A spawner node reads an exported array of these resources and instances the corresponding enemies at runtime.

## Requirements
- A custom `Resource` describing per-enemy stats (name, max health, speed, damage, color).
- Three concrete `.tres` files with distinct stats for `goblin`, `orc`, and `dragon`.
- An `Enemy` scene whose script applies the stats at runtime (color, current health) and supports taking damage / freeing itself when dead.
- A `Spawner` scene whose script accepts an array of stats resources and instances one enemy per resource, parented under itself, at different positions.
- A bulk damage helper on the spawner that damages every spawned enemy by the same amount.

## Implementation Hints
- Use `extends Resource` with `class_name` and `@export` properties for the stats container. Save the resources as `.tres` text files so they can be inspected and loaded with `load()`.
- The `Enemy` script should take the stats resource as an `@export` and configure itself in `_ready`. Use a `ColorRect` child for visualization.
- The `Spawner` script should use `@export var enemy_types: Array[EnemyStats]` so the array of typed resources can be assigned in the editor or programmatically via `set()`.
- Use `queue_free()` to remove dead enemies; remember that nodes are not actually removed from the tree until the next idle frame, so any verification should `await get_tree().process_frame` before counting children.

## Acceptance Criteria
- Project path: /home/user/myproject
- Command: `godot --headless --path /home/user/myproject --quit-after 60`
- Required files (paths are relative to the project root):
  - `scripts/EnemyStats.gd` — extends `Resource` with `class_name EnemyStats` and five `@export` properties: `name: String`, `max_health: int`, `speed: float`, `damage: int`, `color: Color`.
  - `resources/enemies/goblin.tres`, `resources/enemies/orc.tres`, `resources/enemies/dragon.tres` — `.tres` files whose loaded value is an `EnemyStats` and whose `name`, `max_health`, `speed`, `damage`, `color` values are pairwise distinct.
  - `scenes/Enemy.tscn` with a `CharacterBody2D` root and a `ColorRect` child; attached script `scripts/Enemy.gd` exporting `stats: EnemyStats`, exposing a `current_health: int` field, applying `stats.color` to the `ColorRect` in `_ready`, and providing `take_damage(amount: int)` that reduces `current_health` and calls `queue_free()` when `current_health <= 0`.
  - `scenes/Spawner.tscn` with a `Node`/`Node2D` root and attached script `scripts/Spawner.gd` exporting `enemy_types: Array[EnemyStats]`; on `_ready` it instances one `Enemy` per entry of `enemy_types`, parents them under itself at distinct positions, and exposes `take_damage_all(amount: int)` which calls `take_damage(amount)` on every spawned enemy.
- The verifier will set the spawner's `enemy_types` to `[goblin, orc, dragon]`, add it to the tree, count the spawned enemy children, call `take_damage_all(9999)`, await a process frame, and confirm all enemies were freed.
- The verifier will also confirm that the color applied to a spawned enemy's `ColorRect` matches its source `EnemyStats.color`.

