extends SceneTree

func _init() -> void:
	var dir = DirAccess.open("res://")
	if not dir.dir_exists("res://resources/dialogs"):
		dir.make_dir_recursive("res://resources/dialogs")
	
	var DialogTreeScript = load("res://scripts/DialogTree.gd")
	var DialogNodeScript = load("res://scripts/DialogNode.gd")
	var DialogChoiceScript = load("res://scripts/DialogChoice.gd")
	
	var tree = DialogTreeScript.new()
	tree.start_id = &"start"
	
	# Node 1: start
	var node_start = DialogNodeScript.new()
	node_start.id = &"start"
	node_start.speaker = "Narrator"
	node_start.text = "You stand before a mysterious glowing portal. A strange merchant is sitting nearby."
	
	var choice_talk = DialogChoiceScript.new()
	choice_talk.label = "Talk to the merchant."
	choice_talk.next_id = &"talk_merchant"
	
	var choice_examine = DialogChoiceScript.new()
	choice_examine.label = "Examine the portal closely."
	choice_examine.next_id = &"examine_portal"
	
	node_start.choices.append(choice_talk)
	node_start.choices.append(choice_examine)
	
	# Node 2: talk_merchant
	var node_talk_merchant = DialogNodeScript.new()
	node_talk_merchant.id = &"talk_merchant"
	node_talk_merchant.speaker = "Merchant"
	node_talk_merchant.text = "Hello, traveler! If you want to cross the portal safely, you will need this magic key. Take it!"
	node_talk_merchant.next_id = &"get_key"
	
	# Node 3: get_key
	var node_get_key = DialogNodeScript.new()
	node_get_key.id = &"get_key"
	node_get_key.speaker = "Narrator"
	node_get_key.text = "The Merchant hands you a heavy golden key."
	node_get_key.next_id = &"portal_choices"
	
	# Node 4: examine_portal
	var node_examine_portal = DialogNodeScript.new()
	node_examine_portal.id = &"examine_portal"
	node_examine_portal.speaker = "Narrator"
	node_examine_portal.text = "The portal crackles with unstable magical energy. It looks extremely dangerous without protection."
	node_examine_portal.next_id = &"portal_choices"
	
	# Node 5: portal_choices
	var node_portal_choices = DialogNodeScript.new()
	node_portal_choices.id = &"portal_choices"
	node_portal_choices.speaker = "Narrator"
	node_portal_choices.text = "What will you do next?"
	
	var choice_blind = DialogChoiceScript.new()
	choice_blind.label = "Step into the portal blindly."
	choice_blind.next_id = &"portal_death"
	
	var choice_key = DialogChoiceScript.new()
	choice_key.label = "Unlock the portal with the golden key."
	choice_key.next_id = &"portal_success"
	choice_key.condition_flag = &"has_key"
	
	var choice_back = DialogChoiceScript.new()
	choice_back.label = "Go back and talk to the merchant."
	choice_back.next_id = &"talk_merchant"
	
	node_portal_choices.choices.append(choice_blind)
	node_portal_choices.choices.append(choice_key)
	node_portal_choices.choices.append(choice_back)
	
	# Node 6: portal_death
	var node_portal_death = DialogNodeScript.new()
	node_portal_death.id = &"portal_death"
	node_portal_death.speaker = "Narrator"
	node_portal_death.text = "The unstable energy tears you apart. You are lost in time and space. Game Over."
	
	# Node 7: portal_success
	var node_portal_success = DialogNodeScript.new()
	node_portal_success.id = &"portal_success"
	node_portal_success.speaker = "Narrator"
	node_portal_success.text = "The key fits perfectly! The portal stabilizes, and you step through into a beautiful new world."
	
	tree.nodes.append(node_start)
	tree.nodes.append(node_talk_merchant)
	tree.nodes.append(node_get_key)
	tree.nodes.append(node_examine_portal)
	tree.nodes.append(node_portal_choices)
	tree.nodes.append(node_portal_death)
	tree.nodes.append(node_portal_success)
	
	var err = ResourceSaver.save(tree, "res://resources/dialogs/intro.tres")
	if err == OK:
		print("Successfully saved intro.tres!")
	else:
		print("Failed to save intro.tres, error code: ", err)
	
	quit()
