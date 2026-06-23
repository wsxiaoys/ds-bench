## Headless validation entry-point. Run with:
##   godot --headless --path <project> --script res://scripts/Validate.gd
extends SceneTree

const DialogChoiceScript := preload("res://scripts/DialogChoice.gd")
const DialogNodeScript   := preload("res://scripts/DialogNode.gd")
const DialogTreeScript   := preload("res://scripts/DialogTree.gd")
const DialogPlayerScript := preload("res://scripts/DialogPlayer.gd")
const DialogUIScript     := preload("res://scripts/DialogUI.gd")

func _init() -> void:
	# Load the dialog tree resource.
	var dialog_tree = load("res://resources/dialogs/intro.tres")
	assert(dialog_tree != null, "intro.tres failed to load")
	assert(dialog_tree.get_script() == DialogTreeScript,
			"intro.tres does not use the DialogTree script")
	assert(dialog_tree.nodes.size() >= 5,
			"intro.tres has fewer than 5 nodes (got %d)" % dialog_tree.nodes.size())

	# Verify start_id resolves.
	var start_node = dialog_tree.get_node(dialog_tree.start_id)
	assert(start_node != null,
			"start_id '%s' does not resolve to a DialogNode" % str(dialog_tree.start_id))

	# Verify a node with 2+ choices exists.
	var has_branching := false
	for n in dialog_tree.nodes:
		if n.choices.size() >= 2:
			has_branching = true
			break
	assert(has_branching, "No DialogNode with 2+ choices found")

	# Verify at least one choice has a non-empty condition_flag.
	var has_condition := false
	for n in dialog_tree.nodes:
		for c in n.choices:
			if c.condition_flag != &"":
				has_condition = true
	assert(has_condition, "No DialogChoice with a non-empty condition_flag found")

	# Load the UI scene.
	var ui_scene = load("res://scenes/DialogUI.tscn")
	assert(ui_scene != null, "DialogUI.tscn failed to load")

	print("=== All validation checks passed ===")
	quit(0)
