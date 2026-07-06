# Coin Collector with Persistent Inventory and HUD

## Background
You are building a small Godot 4 game module that demonstrates several core Godot concepts working together: scene composition, signals, autoload singletons, input handling, physics, and persistence. The game is a 2D "Coin Collector" where the player moves around with arrow keys and picks up coins. A HUD reports the current coin count, and an autoload singleton keeps the inventory and saves the count to disk so it survives restarts.

Godot 4 (>= 4.3) is installed in the environment as the headless binary `godot`.

## Requirements
- **Project Location**: Create a valid Godot 4 project at `/home/user/coin_collector` (containing a `project.godot` at the root).
- **File Layout & Scene Structure**:
  - `project.godot`
  - `autoloads/Inventory.gd`: Script for the global autoload singleton.
  - `scenes/Player.tscn`: A scene with a root node of type `CharacterBody2D` named `Player` and an attached GDScript.
  - `scenes/Coin.tscn`: A scene with a root node of type `Area2D` named `Coin` and an attached GDScript.
  - `scenes/HUD.tscn`: A scene with a root node of type `CanvasLayer` named `HUD` and an attached GDScript.
  - `scenes/Main.tscn`: A scene that instantiates the `Player`, the `HUD`, and at least one `Coin`.
- **Player Movement**: The player must move with the arrow keys, controlled via `CharacterBody2D` and `move_and_slide()` inside `_physics_process`. Movement responds to standard `ui_left`/`ui_right`/`ui_up`/`ui_down` actions via `Input.get_axis`.
- **Coin Collection**: Each coin must be an `Area2D` that declares a custom `signal collected`. When its `body_entered` signal is triggered by the player, the handler must call `Inventory.add_coin()` and then `queue_free()` to remove the coin.
- **HUD Overlay**: The HUD must contain a `Label` child node whose text is updated to reflect the current coin count whenever `Inventory.coin_changed` is emitted (not by polling in `_process`).
- **Inventory Autoload API**:
  - Register the `Inventory` autoload singleton in `project.godot` under the `[autoload]` section as `Inventory="*res://autoloads/Inventory.gd"`.
  - The `Inventory` script must implement the following API:
    - `signal coin_changed(new_count: int)`: Emitted whenever the coin count changes (including when loaded).
    - `add_coin()`: Method that increments the stored count by 1 and emits `coin_changed` with the new count.
    - `get_count() -> int`: Method that returns the current coin count.
    - `save()`: Method that writes the current count to `user://save.json` as JSON (an object containing the count field, e.g., `{"count": <int>}`).
    - `load()`: Method that reads `user://save.json` (if present), restores the count, and emits `coin_changed` with the restored count.
    - **Persistence**: On startup, the autoload must restore the count from `user://save.json` (by calling `load()`). On application quit (e.g., via `NOTIFICATION_WM_CLOSE_REQUEST` or equivalent quit handling), it must save the current count (by calling `save()`).

## Implementation Hints
- Use Godot 4 scenes (`.tscn`) and GDScript (`.gd`). Stick to GDScript; do not use C# or GDExtension.
- Use `Input.get_axis("ui_left", "ui_right")` / `Input.get_axis("ui_up", "ui_down")` for movement, and `move_and_slide()` in `_physics_process`.
- Use `FileAccess` with `JSON.stringify` / `JSON.parse_string` to persist to `user://save.json`.
- Godot will run headless during verification. Make sure the project loads cleanly without errors and exits with code 0 using `godot --headless --path /home/user/coin_collector --quit` (no script parse errors).
