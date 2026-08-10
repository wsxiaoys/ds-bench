extends RefCounted

class EntityLocation extends RefCounted:
	var generation: int = 1
	var is_alive: bool = false
	var archetype: Archetype = null
	var index_in_archetype: int = -1

class Archetype extends RefCounted:
	var types: Array[StringName] = []
	var entities: Array[int] = []
	# Maps component_type (StringName) to Array (the actual component data for each entity in the archetype)
	var components: Dictionary = {}

	func _init(p_types: Array[StringName]) -> void:
		types = p_types
		for t in types:
			components[t] = []

var _entity_locations: Array[EntityLocation] = []
var _free_slots: Array[int] = []
var _archetypes: Dictionary = {}

func _init() -> void:
	# Initialize the empty archetype
	_archetypes[""] = Archetype.new([])

func create_entity() -> int:
	var slot_index: int
	var gen: int
	if not _free_slots.is_empty():
		slot_index = _free_slots.pop_back()
		var loc = _entity_locations[slot_index]
		loc.is_alive = true
		gen = loc.generation
	else:
		slot_index = _entity_locations.size()
		gen = 1
		var loc = EntityLocation.new()
		loc.generation = 1
		loc.is_alive = true
		_entity_locations.append(loc)
	
	# Add to empty archetype
	var empty_arch = _archetypes[""]
	var index_in_arch = empty_arch.entities.size()
	var entity_handle = (gen << 32) | slot_index
	empty_arch.entities.append(entity_handle)
	
	_entity_locations[slot_index].archetype = empty_arch
	_entity_locations[slot_index].index_in_archetype = index_in_arch
	
	return entity_handle

func destroy_entity(entity: int) -> bool:
	if not is_alive(entity):
		return false
	
	var slot_index = get_index(entity)
	var loc = _entity_locations[slot_index]
	
	# Remove from its current archetype
	var arch = loc.archetype
	var idx = loc.index_in_archetype
	
	_remove_entity_from_archetype(arch, idx)
	
	# Mark slot as dead and increment generation
	loc.is_alive = false
	loc.generation += 1
	loc.archetype = null
	loc.index_in_archetype = -1
	
	_free_slots.append(slot_index)
	return true

func is_alive(entity: int) -> bool:
	var idx = get_index(entity)
	if idx < 0 or idx >= _entity_locations.size():
		return false
	var loc = _entity_locations[idx]
	return loc.is_alive and loc.generation == get_generation(entity)

func get_index(entity: int) -> int:
	return entity & 0xFFFFFFFF

func get_generation(entity: int) -> int:
	return (entity >> 32) & 0x7FFFFFFF

func add_component(entity: int, component_type: StringName, data: Dictionary) -> bool:
	if not is_alive(entity):
		return false
	
	var slot_index = get_index(entity)
	var loc = _entity_locations[slot_index]
	var old_arch = loc.archetype
	var idx_in_old = loc.index_in_archetype
	
	# Check if entity already holds the component_type
	var has_comp = false
	for t in old_arch.types:
		if t == component_type:
			has_comp = true
			break
	
	if has_comp:
		# If the entity already holds component_type, replaces that component's data with data and leaves its archetype unchanged.
		old_arch.components[component_type][idx_in_old] = data
		return true
	
	# Otherwise, migrate to a new archetype
	# New type set is old types + component_type
	var new_types_raw = old_arch.types.duplicate()
	new_types_raw.append(component_type)
	var canonical_new_types = _canonicalize_types(new_types_raw)
	var new_key = _get_archetype_key(canonical_new_types)
	
	# Get or create the new archetype
	var new_arch: Archetype
	if _archetypes.has(new_key):
		new_arch = _archetypes[new_key]
	else:
		new_arch = Archetype.new(canonical_new_types)
		_archetypes[new_key] = new_arch
	
	# We need to migrate the entity from old_arch to new_arch.
	# First, gather all component data that is being kept, plus the new component data.
	var migrated_data: Dictionary = {}
	for t in old_arch.types:
		migrated_data[t] = old_arch.components[t][idx_in_old]
	migrated_data[component_type] = data
	
	# Add entity to new archetype
	var idx_in_new = new_arch.entities.size()
	new_arch.entities.append(entity)
	for t in new_arch.types:
		new_arch.components[t].append(migrated_data[t])
	
	# Remove entity from old archetype
	_remove_entity_from_archetype(old_arch, idx_in_old)
	
	# Update entity location
	loc.archetype = new_arch
	loc.index_in_archetype = idx_in_new
	
	return true

func remove_component(entity: int, component_type: StringName) -> bool:
	if not is_alive(entity):
		return false
	
	var slot_index = get_index(entity)
	var loc = _entity_locations[slot_index]
	var old_arch = loc.archetype
	var idx_in_old = loc.index_in_archetype
	
	# Check if entity holds the component_type
	var has_comp = false
	for t in old_arch.types:
		if t == component_type:
			has_comp = true
			break
	
	if not has_comp:
		return false
	
	# Migrate to a new archetype
	# New type set is old types minus component_type
	var new_types_raw = old_arch.types.duplicate()
	new_types_raw.erase(component_type)
	var canonical_new_types = _canonicalize_types(new_types_raw)
	var new_key = _get_archetype_key(canonical_new_types)
	
	# Get or create the new archetype
	var new_arch: Archetype
	if _archetypes.has(new_key):
		new_arch = _archetypes[new_key]
	else:
		new_arch = Archetype.new(canonical_new_types)
		_archetypes[new_key] = new_arch
	
	# Gather all component data that is being kept
	var migrated_data: Dictionary = {}
	for t in old_arch.types:
		if t != component_type:
			migrated_data[t] = old_arch.components[t][idx_in_old]
	
	# Add entity to new archetype
	var idx_in_new = new_arch.entities.size()
	new_arch.entities.append(entity)
	for t in new_arch.types:
		new_arch.components[t].append(migrated_data[t])
	
	# Remove entity from old archetype
	_remove_entity_from_archetype(old_arch, idx_in_old)
	
	# Update entity location
	loc.archetype = new_arch
	loc.index_in_archetype = idx_in_new
	
	return true

func has_component(entity: int, component_type: StringName) -> bool:
	if not is_alive(entity):
		return false
	var slot_index = get_index(entity)
	var loc = _entity_locations[slot_index]
	var arch = loc.archetype
	return component_type in arch.components

func get_component(entity: int, component_type: StringName) -> Variant:
	if not is_alive(entity):
		return null
	var slot_index = get_index(entity)
	var loc = _entity_locations[slot_index]
	var arch = loc.archetype
	if not component_type in arch.components:
		return null
	var idx = loc.index_in_archetype
	return arch.components[component_type][idx]

func get_component_types(entity: int) -> Variant:
	if not is_alive(entity):
		return null
	var slot_index = get_index(entity)
	var loc = _entity_locations[slot_index]
	return loc.archetype.types.duplicate()

func query(required_types: Array) -> Array:
	var req_types = _canonicalize_types(required_types)
	var matching_entities: Array = []
	
	for arch in _archetypes.values():
		var match_ok = true
		for req_t in req_types:
			if not req_t in arch.components:
				match_ok = false
				break
		if match_ok:
			for entity in arch.entities:
				matching_entities.append(entity)
	
	# Sort matching_entities by ascending index
	matching_entities.sort_custom(func(a, b):
		return get_index(a) < get_index(b)
	)
	return matching_entities

func get_entities_with_exact_types(types: Array) -> Array:
	var canonical = _canonicalize_types(types)
	var key = _get_archetype_key(canonical)
	if not _archetypes.has(key):
		return []
	
	var arch = _archetypes[key]
	var result = arch.entities.duplicate()
	result.sort_custom(func(a, b):
		return get_index(a) < get_index(b)
	)
	return result

func _remove_entity_from_archetype(arch: Archetype, idx: int) -> void:
	var last_idx = arch.entities.size() - 1
	if idx < last_idx:
		# Swap with the last element
		var last_entity = arch.entities[last_idx]
		arch.entities[idx] = last_entity
		
		# Swap component data
		for t in arch.types:
			arch.components[t][idx] = arch.components[t][last_idx]
		
		# Update the moved entity's location index
		var last_entity_index = get_index(last_entity)
		_entity_locations[last_entity_index].index_in_archetype = idx
	
	# Pop the last element
	arch.entities.pop_back()
	for t in arch.types:
		arch.components[t].pop_back()

func _canonicalize_types(types: Array) -> Array[StringName]:
	var unique_strings: Array[String] = []
	for t in types:
		var s = String(t)
		if not s in unique_strings:
			unique_strings.append(s)
	unique_strings.sort()
	var result: Array[StringName] = []
	for s in unique_strings:
		result.append(StringName(s))
	return result

func _get_archetype_key(canonical_types: Array[StringName]) -> String:
	var parts: Array[String] = []
	for t in canonical_types:
		parts.append(String(t))
	return ",".join(parts)
