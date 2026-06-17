extends SceneTree

func _init() -> void:
	print("=== Validating Dialog Branching System ===")

	# Load scripts to verify they parse
	var choice_script = load("res://scripts/DialogChoice.gd")
	assert(choice_script != null, "Failed to load DialogChoice.gd")
	print("OK: DialogChoice.gd")

	var node_script = load("res://scripts/DialogNode.gd")
	assert(node_script != null, "Failed to load DialogNode.gd")
	print("OK: DialogNode.gd")

	var tree_script = load("res://scripts/DialogTree.gd")
	assert(tree_script != null, "Failed to load DialogTree.gd")
	print("OK: DialogTree.gd")

	var player_script = load("res://scripts/DialogPlayer.gd")
	assert(player_script != null, "Failed to load DialogPlayer.gd")
	print("OK: DialogPlayer.gd")

	var ui_script = load("res://scripts/DialogUI.gd")
	assert(ui_script != null, "Failed to load DialogUI.gd")
	print("OK: DialogUI.gd")

	# Load the sample dialog tree
	var dialog_tree = load("res://resources/dialogs/intro.tres")
	assert(dialog_tree != null, "Failed to load intro.tres")
	assert(dialog_tree is Resource, "intro.tres is not a Resource")
	print("OK: intro.tres loaded as Resource")

	# Verify 5+ nodes
	var nodes = dialog_tree.get("nodes")
	assert(nodes != null, "No 'nodes' property")
	assert(nodes.size() >= 5, "Expected 5+ nodes, got %d" % nodes.size())
	print("OK: %d nodes in tree" % nodes.size())

	# Verify start_id
	var start_id = dialog_tree.get("start_id")
	assert(start_id == &"node_1", "start_id should be node_1, got %s" % start_id)
	print("OK: start_id = %s" % start_id)

	# Verify get_node method
	var n1 = dialog_tree.get_node(&"node_1")
	assert(n1 != null, "get_node('node_1') returned null")
	print("OK: get_node('node_1') works")

	# Verify at least one node has 2+ choices
	var has_branching = false
	var has_condition_flag = false
	for node in nodes:
		var choices = node.get("choices")
		if choices.size() >= 2:
			has_branching = true
		for choice in choices:
			var cf = choice.get("condition_flag")
			if cf != &"":
				has_condition_flag = true
	assert(has_branching, "No node has 2+ choices")
	assert(has_condition_flag, "No choice has a non-empty condition_flag")
	print("OK: branching (2+ choices) present")
	print("OK: condition_flag present")

	# Test DialogPlayer
	print("--- Testing DialogPlayer ---")
	var PlayerClass = load("res://scripts/DialogPlayer.gd")
	var player = PlayerClass.new()
	player.set("tree", dialog_tree)

	var lines_received = []

	player.line_shown.connect(func(speaker, text, labels):
		lines_received.append({"speaker": speaker, "text": text, "labels": labels})
		print("  line_shown: speaker=%s, text=%s, choices=%s" % [speaker, text, str(labels)])
	)

	var finished_received = false
	player.dialog_finished.connect(func():
		finished_received = true
		print("  dialog_finished")
	)

	# Start dialog
	player.start()
	assert(lines_received.size() == 1, "Expected 1 line after start, got %d" % lines_received.size())
	assert(lines_received[0].speaker == "Stranger", "Unexpected speaker")
	assert(lines_received[0].labels.size() == 3, "Expected 3 visible choices at node_1, got %d" % lines_received[0].labels.size())

	# Test set_flag / has_flag
	player.set_flag(&"has_secret")
	assert(player.has_flag(&"has_secret"), "has_flag should return true after set")
	assert(not player.has_flag(&"nonexistent"), "has_flag should return false for unset flag")
	print("OK: set_flag/has_flag works")

	# Advance to node_2 (choice 0: "Tell me more.")
	player.advance(0)
	assert(lines_received.size() == 2, "Expected 2 lines after advance, got %d" % lines_received.size())
	# node_2 has 3 choices: "Who are you?", "I have a secret..." (visible because has_secret is set), "Goodbye."
	assert(lines_received[1].labels.size() == 3, "Expected 3 visible choices at node_2 (secret flag set), got %d" % lines_received[1].labels.size())
	print("OK: condition_flag filtering - secret choice visible when flag set")

	# Test that condition_flag filtering works: unset the flag and restart
	var player2 = PlayerClass.new()
	player2.set("tree", dialog_tree)
	var test_data = {"labels": []}
	player2.line_shown.connect(func(_s, _t, labels):
		test_data["labels"] = labels
		print("  player2 line_shown: choices=%s" % str(labels))
	)
	player2.start()
	assert(player2.has_flag(&"has_secret") == false, "has_secret should be false in new player")
	player2.advance(0)  # Go to node_2
	# node_2: "Who are you?", "I have a secret..." (HIDDEN because has_secret not set), "Goodbye."
	assert(test_data["labels"].size() == 2, "Expected 2 visible choices at node_2 (secret flag not set), got %d" % test_data["labels"].size())
	print("OK: condition_flag filtering works correctly - secret choice hidden when flag not set")

	# Test dialog_finished: advance from node_5 (which has no choices and no next_id)
	var player3 = PlayerClass.new()
	player3.set("tree", dialog_tree)
	var finished3 = false
	player3.dialog_finished.connect(func(): finished3 = true)
	player3.start()
	player3.advance(2)  # "Goodbye." -> node_5
	# node_5 has no choices and no next_id, should emit dialog_finished
	assert(finished3, "dialog_finished should have been emitted")
	print("OK: dialog_finished emitted correctly")

	print("=== ALL VALIDATIONS PASSED ===")
	quit(0)
