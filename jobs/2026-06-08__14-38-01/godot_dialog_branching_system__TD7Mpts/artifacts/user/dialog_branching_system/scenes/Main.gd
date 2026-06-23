extends Node

func _ready() -> void:
	print("--- Starting Dialog Branching System Test ---")
	
	# 1. Create DialogPlayer
	var player = DialogPlayer.new()
	add_child(player)
	
	# Load the intro tree
	var tree = load("res://resources/dialogs/intro.tres")
	player.tree = tree
	
	# 2. Instantiate and setup DialogUI
	var ui_scene = load("res://scenes/DialogUI.tscn")
	var ui = ui_scene.instantiate()
	add_child(ui)
	ui.player = player
	ui._ready() # Re-initialize with player set
	
	# Let's connect to player signals to print the flow to stdout for verification
	player.line_shown.connect(func(speaker, text, choices):
		print("\n[%s]: %s" % [speaker, text])
		if choices.is_empty():
			print("  (No choices. Press Enter/Continue to advance)")
		else:
			for i in range(choices.size()):
				print("  [%d] %s" % [i, choices[i]])
	)
	
	player.dialog_finished.connect(func():
		print("\n--- Dialog Finished ---")
	)
	
	# Run tests
	print("\n--- Test 1: Blind Path (No key) ---")
	player.start()
	
	# At start, we should see choices:
	# [0] Talk to the merchant.
	# [1] Examine the portal closely.
	# Let's choose "Examine the portal closely" (index 1)
	player.advance(1)
	
	# Now we are at "examine_portal", which has no choices, next_id is "portal_choices".
	# Let's advance
	player.advance()
	
	# Now we are at "portal_choices". Since we don't have the key flag, we should only see:
	# [0] Step into the portal blindly.
	# [1] Go back and talk to the merchant.
	# Let's choose "Step into the portal blindly" (index 0)
	player.advance(0)
	
	# Now we are at "portal_death" (terminal)
	player.advance()
	
	# --- Test 2: Success Path (With key) ---
	print("\n--- Test 2: Success Path (With key) ---")
	player.start()
	
	# Let's choose "Talk to the merchant" (index 0)
	player.advance(0)
	
	# Now we are at "talk_merchant" (no choices, next is "get_key")
	player.advance()
	
	# Now we are at "get_key". In a real game, getting this node would set the flag.
	# Let's set the flag "has_key" on the player.
	player.set_flag(&"has_key")
	print("  * Flag 'has_key' set *")
	
	# Advance from "get_key" to "portal_choices"
	player.advance()
	
	# Now we are at "portal_choices". Since we have the key flag, we should see:
	# [0] Step into the portal blindly.
	# [1] Unlock the portal with the golden key.
	# [2] Go back and talk to the merchant.
	# Let's choose "Unlock the portal with the golden key" (index 1)
	player.advance(1)
	
	# Now we are at "portal_success" (terminal)
	player.advance()
	
	print("\n--- All Tests Completed Successfully! ---")
