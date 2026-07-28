extends RefCounted

# Minimal archetype-based Entity Component System.
#
# Entities are represented as a single non-negative int handle that packs a
# reusable slot "index" (low bits) and a "generation" counter (high bits).
# Each slot's generation is incremented every time the slot's entity is
# destroyed, so stale handles referring to a destroyed (and possibly reused)
# slot are reliably detected via `is_alive`.
#
# An entity's "archetype" is the exact set of component types it currently
# holds. That set is tracked per-slot (`_types`) and kept sorted so that
# archetype-equality checks (`get_entities_with_exact_types`) reduce to a
# simple array comparison, while component data itself is preserved across
# archetype migrations because it lives in a per-type dictionary
# (`_components`) that is never rebuilt on add/remove -- only the type set
# changes.

const INDEX_BITS := 32
const INDEX_MASK := (1 << INDEX_BITS) - 1

# Per-slot storage, indexed by "index" (the low bits of a handle).
var _generations: Array = []   # int: current generation for this slot
var _alive: Array = []         # bool: whether this slot currently holds a living entity
var _types: Array = []         # Array[StringName]: sorted, de-duplicated component types (the archetype)
var _components: Array = []    # Dictionary: component_type(StringName) -> Dictionary data

var _free_indices: Array = []  # int: recycled slot indices available for reuse


# ---------------------------------------------------------------------------
# Handle helpers
# ---------------------------------------------------------------------------

func _make_handle(index: int, generation: int) -> int:
	return (generation << INDEX_BITS) | index


func get_index(entity: int) -> int:
	return entity & INDEX_MASK


func get_generation(entity: int) -> int:
	return entity >> INDEX_BITS


func _slot_exists(index: int) -> bool:
	return index >= 0 and index < _alive.size()


func is_alive(entity: int) -> bool:
	var index := get_index(entity)
	var generation := get_generation(entity)
	if not _slot_exists(index):
		return false
	return _alive[index] and _generations[index] == generation


# ---------------------------------------------------------------------------
# Entity lifecycle
# ---------------------------------------------------------------------------

func create_entity() -> int:
	var index: int
	if _free_indices.size() > 0:
		index = _free_indices.pop_back()
	else:
		index = _generations.size()
		_generations.append(0)
		_alive.append(false)
		_types.append([])
		_components.append({})

	_alive[index] = true
	_types[index] = []
	_components[index] = {}

	return _make_handle(index, _generations[index])


func destroy_entity(entity: int) -> bool:
	if not is_alive(entity):
		return false

	var index := get_index(entity)
	_alive[index] = false
	_generations[index] += 1
	_types[index] = []
	_components[index] = {}
	_free_indices.append(index)
	return true


# ---------------------------------------------------------------------------
# Components
# ---------------------------------------------------------------------------

func add_component(entity: int, component_type: StringName, data: Dictionary) -> bool:
	if not is_alive(entity):
		return false

	var index := get_index(entity)
	var comps: Dictionary = _components[index]

	if comps.has(component_type):
		comps[component_type] = data.duplicate(true)
		return true

	comps[component_type] = data.duplicate(true)

	var types: Array = _types[index]
	types.append(component_type)
	_types[index] = _sort_types(types)
	return true


func remove_component(entity: int, component_type: StringName) -> bool:
	if not is_alive(entity):
		return false

	var index := get_index(entity)
	var comps: Dictionary = _components[index]

	if not comps.has(component_type):
		return false

	comps.erase(component_type)

	var types: Array = _types[index]
	types.erase(component_type)
	_types[index] = types
	return true


func has_component(entity: int, component_type: StringName) -> bool:
	if not is_alive(entity):
		return false
	var index := get_index(entity)
	return (_components[index] as Dictionary).has(component_type)


func get_component(entity: int, component_type: StringName):
	if not is_alive(entity):
		return null
	var index := get_index(entity)
	var comps: Dictionary = _components[index]
	if not comps.has(component_type):
		return null
	return comps[component_type]


func get_component_types(entity: int):
	if not is_alive(entity):
		return null
	var index := get_index(entity)
	return (_types[index] as Array).duplicate()


# ---------------------------------------------------------------------------
# Queries
# ---------------------------------------------------------------------------

func query(required_types: Array) -> Array:
	var required := _unique_sorted_types(required_types)

	var indices: Array = []
	for index in range(_alive.size()):
		if _alive[index] and _is_superset(_types[index], required):
			indices.append(index)
	indices.sort()

	var handles: Array = []
	for index in indices:
		handles.append(_make_handle(index, _generations[index]))
	return handles


func get_entities_with_exact_types(types: Array) -> Array:
	var target := _unique_sorted_types(types)

	var indices: Array = []
	for index in range(_alive.size()):
		if _alive[index] and _types[index] == target:
			indices.append(index)
	indices.sort()

	var handles: Array = []
	for index in indices:
		handles.append(_make_handle(index, _generations[index]))
	return handles


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

func _sort_types(types: Array) -> Array:
	var arr := types.duplicate()
	arr.sort_custom(func(a, b): return String(a) < String(b))
	return arr


func _unique_sorted_types(types: Array) -> Array:
	var seen := {}
	var unique: Array = []
	for t in types:
		var st := StringName(t)
		if not seen.has(st):
			seen[st] = true
			unique.append(st)
	return _sort_types(unique)


func _is_superset(have: Array, required: Array) -> bool:
	for t in required:
		if not have.has(t):
			return false
	return true
