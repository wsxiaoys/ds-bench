# Dialog Branching System

Build a branching dialog system in Godot 4 driven by custom Resources.

Godot 4 (>= 4.3) is installed in the environment as the headless binary `godot`.

## Acceptance Criteria

- Project path: `/home/user/dialog_branching_system`
- The project must be a valid Godot 4 project (`project.godot` at the root) and must load cleanly under `godot --headless --path <project> --quit` (exit code 0, no script parse errors).

### Custom Resources

- `scripts/DialogNode.gd` — `extends Resource`, `class_name DialogNode`. `@export` properties:
  - `id: StringName`
  - `speaker: String`
  - `text: String`
  - `choices: Array[DialogChoice]`
  - `next_id: StringName` (used when `choices` is empty)
- `scripts/DialogChoice.gd` — `extends Resource`, `class_name DialogChoice`. `@export` properties:
  - `label: String`
  - `next_id: StringName`
  - `condition_flag: StringName` (empty means the choice is always shown)
- `scripts/DialogTree.gd` — `extends Resource`, `class_name DialogTree`. `@export` properties: `nodes: Array[DialogNode]`, `start_id: StringName`. Provides a method `get_node(id: StringName) -> DialogNode` that returns the node whose `id` matches.

### Sample Data

- `resources/dialogs/intro.tres` is a `DialogTree` resource that loads as a `DialogTree` instance and has **5 or more** `DialogNode` entries forming a branching tree. At least one node has 2+ choices, and at least one choice uses a non-empty `condition_flag`.

### DialogPlayer Node

- `scripts/DialogPlayer.gd` — `class_name DialogPlayer`, extends `Node`. `@export var tree: DialogTree`.
- Methods:
  - `start()`: begins playback at `tree.start_id`.
  - `advance(choice_index: int = -1)`: follows the chosen branch when the current node has choices, or follows `next_id` when there are no choices. If the current node has empty `choices` and empty `next_id`, emit `dialog_finished` and stop.
  - `set_flag(name: StringName)` / `has_flag(name: StringName) -> bool`: maintain an internal `Dictionary` of set flags.
- Signals:
  - `line_shown(speaker: String, text: String, choices_labels: Array)` — emitted each time a new node is presented. `choices_labels` lists the labels of currently visible choices (a choice with a non-empty `condition_flag` is only visible when that flag has been set via `set_flag`).
  - `dialog_finished` — emitted when playback ends.

### DialogUI Scene

- `scenes/DialogUI.tscn` is a `Control` root containing a `RichTextLabel` for body text, a `Label` for the speaker, and a `VBoxContainer` for choice buttons.
- The attached script connects to a `DialogPlayer` and updates the speaker `Label.text`, the `RichTextLabel.text`, and rebuilds the `VBoxContainer`'s `Button` children from `choices_labels` whenever `line_shown` fires.

