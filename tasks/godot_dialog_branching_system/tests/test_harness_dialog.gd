extends Node


var _line_events: Array = []
var _finished_count: int = 0


func _ready() -> void:
	var ok: bool = await _run_tests()
	if ok:
		print("HARNESS_OK")
		get_tree().quit(0)
	else:
		get_tree().quit(1)


func _run_tests() -> bool:
	# ------------------------------------------------------------------
	# 1. Validate the sample intro.tres custom resource.
	# ------------------------------------------------------------------
	var intro_path := "res://resources/dialogs/intro.tres"
	if not ResourceLoader.exists(intro_path):
		printerr("FAIL: missing resource at ", intro_path)
		return false
	var intro = load(intro_path)
	if intro == null:
		printerr("FAIL: could not load ", intro_path)
		return false
	if not (intro is DialogTree):
		printerr("FAIL: ", intro_path, " is not a DialogTree (got ", intro.get_class(), ")")
		return false

	var intro_nodes = intro.nodes
	if intro_nodes == null:
		printerr("FAIL: DialogTree.nodes is null on intro.tres")
		return false
	if intro_nodes.size() < 5:
		printerr("FAIL: intro.tres must have >=5 DialogNodes; got ", intro_nodes.size())
		return false

	var has_multi_choice := false
	var has_condition_flag := false
	for n in intro_nodes:
		if n == null:
			continue
		var n_choices = n.choices
		if n_choices != null and n_choices.size() >= 2:
			has_multi_choice = true
		if n_choices != null:
			for c in n_choices:
				if c == null:
					continue
				if String(c.condition_flag) != "":
					has_condition_flag = true
	if not has_multi_choice:
		printerr("FAIL: intro.tres must contain at least one node with 2+ choices")
		return false
	if not has_condition_flag:
		printerr("FAIL: intro.tres must contain at least one DialogChoice with a non-empty condition_flag")
		return false

	if not intro.has_method("get_node"):
		printerr("FAIL: DialogTree must expose a get_node(id) method")
		return false
	var start_node = intro.get_node(intro.start_id)
	if start_node == null:
		printerr("FAIL: intro.get_node(intro.start_id) returned null")
		return false

	# ------------------------------------------------------------------
	# 2. start() emits line_shown with start node's speaker/text.
	# ------------------------------------------------------------------
	var p1: Node = _new_player(intro)
	p1.start()
	await _wait_frames(2)
	if _line_events.is_empty():
		printerr("FAIL: start() did not emit any line_shown signal")
		return false
	var first_event = _line_events[0]
	if String(first_event[0]) != String(start_node.speaker):
		printerr("FAIL: first line_shown speaker '", first_event[0],
				"' does not match start node speaker '", start_node.speaker, "'")
		return false
	if String(first_event[1]) != String(start_node.text):
		printerr("FAIL: first line_shown text does not match start node text")
		return false
	_cleanup_player(p1)

	# ------------------------------------------------------------------
	# 3. advance(0) follows the first choice's next_id and emits line_shown.
	# ------------------------------------------------------------------
	var cn_a := DialogNode.new()
	cn_a.id = &"a"
	cn_a.speaker = "Alice"
	cn_a.text = "Hello"
	var cn_b := DialogNode.new()
	cn_b.id = &"b"
	cn_b.speaker = "Bob"
	cn_b.text = "World"
	var cn_c := DialogNode.new()
	cn_c.id = &"c"
	cn_c.speaker = "Carol"
	cn_c.text = "Bye"
	var ch_b := DialogChoice.new()
	ch_b.label = "go_b"
	ch_b.next_id = &"b"
	var ch_c := DialogChoice.new()
	ch_c.label = "go_c"
	ch_c.next_id = &"c"
	var a_choices: Array[DialogChoice] = [ch_b, ch_c]
	cn_a.choices = a_choices

	var branch_tree := DialogTree.new()
	var branch_nodes: Array[DialogNode] = [cn_a, cn_b, cn_c]
	branch_tree.nodes = branch_nodes
	branch_tree.start_id = &"a"

	var p2: Node = _new_player(branch_tree)
	p2.start()
	await _wait_frames(2)
	p2.advance(0)
	await _wait_frames(2)
	if _line_events.size() < 2:
		printerr("FAIL: advance(0) did not produce a second line_shown event")
		return false
	var second_event = _line_events[1]
	if String(second_event[0]) != "Bob" or String(second_event[1]) != "World":
		printerr("FAIL: advance(0) did not navigate to the first choice's next_id; got speaker='",
				second_event[0], "' text='", second_event[1], "'")
		return false
	_cleanup_player(p2)

	# ------------------------------------------------------------------
	# 4. Reaching a terminal node (empty choices AND empty next_id)
	#    emits dialog_finished.
	# ------------------------------------------------------------------
	var t_start := DialogNode.new()
	t_start.id = &"s"
	t_start.speaker = "S"
	t_start.text = "first"
	t_start.next_id = &"end"
	var t_end := DialogNode.new()
	t_end.id = &"end"
	t_end.speaker = "E"
	t_end.text = "last"
	# t_end has empty choices (default) and empty next_id (default StringName "").

	var term_tree := DialogTree.new()
	var term_nodes: Array[DialogNode] = [t_start, t_end]
	term_tree.nodes = term_nodes
	term_tree.start_id = &"s"

	var p3: Node = _new_player(term_tree)
	p3.start()
	await _wait_frames(2)
	# Advance up to a few times, watching for dialog_finished.
	var tries := 0
	while _finished_count == 0 and tries < 3:
		p3.advance()
		await _wait_frames(2)
		tries += 1
	if _finished_count < 1:
		printerr("FAIL: dialog_finished was not emitted after reaching the terminal node")
		return false
	_cleanup_player(p3)

	# ------------------------------------------------------------------
	# 5. Condition flag gates a choice's visibility.
	# ------------------------------------------------------------------
	var cf_a := DialogNode.new()
	cf_a.id = &"a"
	cf_a.speaker = "Guard"
	cf_a.text = "Which way?"
	var cf_b := DialogNode.new()
	cf_b.id = &"b"
	cf_b.speaker = "Guard"
	cf_b.text = "OK"
	var ch_open := DialogChoice.new()
	ch_open.label = "open_path"
	ch_open.next_id = &"b"
	var ch_gated := DialogChoice.new()
	ch_gated.label = "secret_path"
	ch_gated.next_id = &"b"
	ch_gated.condition_flag = &"helped_npc"
	var cf_choices: Array[DialogChoice] = [ch_open, ch_gated]
	cf_a.choices = cf_choices

	var cf_tree := DialogTree.new()
	var cf_nodes: Array[DialogNode] = [cf_a, cf_b]
	cf_tree.nodes = cf_nodes
	cf_tree.start_id = &"a"

	# 5a. Without the flag set, the gated choice should be hidden.
	var p4: Node = _new_player(cf_tree)
	p4.start()
	await _wait_frames(2)
	if _line_events.is_empty():
		printerr("FAIL: condition-flag test did not receive line_shown after start")
		return false
	var labels_no_flag = _line_events[_line_events.size() - 1][2]
	if _labels_contain(labels_no_flag, "secret_path"):
		printerr("FAIL: gated choice 'secret_path' should NOT be visible without helped_npc; got ",
				labels_no_flag)
		return false
	if not _labels_contain(labels_no_flag, "open_path"):
		printerr("FAIL: unconditional choice 'open_path' must always be visible; got ",
				labels_no_flag)
		return false
	_cleanup_player(p4)

	# 5b. After setting the flag, the gated choice should appear.
	var p5: Node = _new_player(cf_tree)
	p5.set_flag(&"helped_npc")
	if not bool(p5.has_flag(&"helped_npc")):
		printerr("FAIL: has_flag(&'helped_npc') should be true after set_flag")
		return false
	p5.start()
	await _wait_frames(2)
	if _line_events.is_empty():
		printerr("FAIL: condition-flag test (with flag) did not receive line_shown after start")
		return false
	var labels_with_flag = _line_events[_line_events.size() - 1][2]
	if not _labels_contain(labels_with_flag, "secret_path"):
		printerr("FAIL: gated choice 'secret_path' must be visible after set_flag(&'helped_npc'); got ",
				labels_with_flag)
		return false
	if not _labels_contain(labels_with_flag, "open_path"):
		printerr("FAIL: unconditional choice 'open_path' must remain visible; got ",
				labels_with_flag)
		return false
	_cleanup_player(p5)

	return true


func _new_player(t) -> Node:
	_line_events.clear()
	_finished_count = 0
	var p: Node = DialogPlayer.new()
	p.tree = t
	p.line_shown.connect(_on_line_shown)
	p.dialog_finished.connect(_on_dialog_finished)
	add_child(p)
	return p


func _cleanup_player(p: Node) -> void:
	if is_instance_valid(p):
		p.queue_free()
	_line_events.clear()
	_finished_count = 0


func _on_line_shown(speaker, text, choices_labels) -> void:
	_line_events.append([speaker, text, choices_labels])


func _on_dialog_finished() -> void:
	_finished_count += 1


func _wait_frames(n: int) -> void:
	for i in range(n):
		await get_tree().process_frame


func _labels_contain(labels, value: String) -> bool:
	if labels == null:
		return false
	for l in labels:
		if String(l) == value:
			return true
	return false
