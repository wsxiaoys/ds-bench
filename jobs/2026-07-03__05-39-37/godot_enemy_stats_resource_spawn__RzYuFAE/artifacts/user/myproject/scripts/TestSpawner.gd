extends SceneTree


func _init() -> void:
	var spawner_scene := load("res://scenes/Spawner.tscn")
	var spawner: Node2D = spawner_scene.instantiate()
	root.add_child(spawner)

	# Verify three enemies were spawned.
	var count := spawner.get_child_count()
	print("spawned children: ", count)
	assert(count == 3, "Expected 3 spawned enemies, got %d" % count)

	# Verify each enemy has correct stats applied.
	var enemies: Array[Node] = spawner.get_children()
	for enemy in enemies:
		var e := enemy as Enemy
		print("enemy: ", e.stats.name, " health=", e.current_health, " color=", e.stats.color)
		assert(e.current_health == e.stats.max_health, "current_health should equal max_health on _ready")
		var cr := e.get_node("ColorRect") as ColorRect
		assert(cr.color == e.stats.color, "ColorRect color should match stats color")

	# Apply bulk damage that kills the goblin (30 hp) but not orc (80) or dragon (200).
	spawner.take_damage_all(30)
	await process_frame

	var alive_count := 0
	for child in spawner.get_children():
		if is_instance_valid(child):
			alive_count += 1
	print("alive after 30 damage: ", alive_count)
	assert(alive_count == 2, "Expected 2 alive enemies after 30 damage, got %d" % alive_count)

	# Kill the rest.
	spawner.take_damage_all(200)
	await process_frame

	alive_count = 0
	for child in spawner.get_children():
		if is_instance_valid(child):
			alive_count += 1
	print("alive after 200 more damage: ", alive_count)
	assert(alive_count == 0, "Expected 0 alive enemies, got %d" % alive_count)

	print("ALL TESTS PASSED")
	quit()