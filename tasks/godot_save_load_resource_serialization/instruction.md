# Save/Load with Custom `Resource` Serialization (Godot 4)

## Background
Implement a save/load system for a hypothetical game in the existing Godot 4 project at `/home/user/myproject`. The save format is a **custom `Resource` subclass** that nests another custom `Resource` (inventory items). Both the human-readable text format (`.tres`) and the compact binary format (`.res`) must round-trip through `ResourceSaver.save` / `ResourceLoader.load` losslessly, with full preservation of nested sub-resources.

## Requirements
You must implement the following custom resources and scripts at the specified paths (relative to the project root):

1. **`scripts/ItemData.gd`**:
   - Must extend `Resource` and declare `class_name ItemData`.
   - Must export at minimum the following fields:
     - `id: String`
     - `quantity: int`
     - `rarity: int`

2. **`scripts/GameSaveData.gd`**:
   - Must extend `Resource` and declare `class_name GameSaveData`.
   - Must export at minimum the following fields:
     - `player_position: Vector2`
     - `inventory: Array[ItemData]`
     - `unlocked_levels: PackedStringArray`
     - `last_played: int`

3. **`scripts/SaveManager.gd`**:
   - Must be a non-`Resource` script (e.g. `extends Node` or `extends RefCounted`) with `class_name SaveManager`.
   - Must implement the following public methods:
     - `save_to_disk(data: GameSaveData, path: String, binary: bool) -> int`:
       Saves `data` to `path`. When `binary == true` the file extension on disk must be `.res`; when `binary == false` it must be `.tres`. The method must accept a path **with or without** an extension, normalize it to the correct extension, and return `OK` (`0`) on success.
     - `load_from_disk(path: String) -> GameSaveData`:
       Loads a `GameSaveData` from the file at `path`. The method must accept the same input forms as `save_to_disk` (with or without extension) and resolve to whichever of `<path>.tres` / `<path>.res` exists, preferring an exact extension match when the caller already provided one.
     - `compute_hash(data: GameSaveData) -> String`:
       Returns a deterministic lowercase hex SHA-256 digest derived from the `GameSaveData` fields and every nested `ItemData`'s fields. Two `GameSaveData` instances with identical field values (including item order) must produce identical hashes; differing values must produce different hashes.

4. **Round-trip & Structural Equality**:
   - Round-tripping a `GameSaveData` (with at least one `ItemData` in the inventory) through both `.tres` and `.res` files must yield a structurally equal instance, including all nested `ItemData` fields.
   - For structural equality, the loaded `GameSaveData` must match the original such that:
     - All four exported fields compare equal element-wise.
     - `inventory.size()` matches.
     - For each index, the loaded item is a `Resource` whose `get_script()` resolves to the `ItemData` script and whose three exported fields equal the originals.

## Implementation Hints
- See [Resources](https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html) and [ResourceSaver](https://docs.godotengine.org/en/stable/classes/class_resourcesaver.html). Use `class_name` and `@export` so the Inspector / `ResourceFormatSaver` can serialize fields. `ResourceSaver.save(resource, path, flags)` writes `.tres` or `.res` based on the file extension; `ResourceLoader.load(path)` reads it back.
- Because the inventory contains nested custom resources, they are serialized as sub-resources of the parent file. No special flag is required for inline sub-resources, but the nested type **must** have its own `class_name`.
- `user://` resolves to a writable directory at runtime; the verifier will pass concrete `user://` paths to the save/load API.
- A simple structural hash can be built from the field values (e.g. concatenating string-formatted fields plus each nested item's fields) and hashing with `HashingContext` (`HASH_SHA256`).
