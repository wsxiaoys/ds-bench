class_name FieldController
extends Node2D

## Resolves the net gravity vector produced by the six configured Area2D
## gravity fields (children of this node) plus the project's default
## gravity, following Godot's own Area2D space-override resolution rules:
##
## 1. Collect every Area2D field whose axis-aligned rectangle contains the
##    queried world position.
## 2. Process those fields from HIGHEST priority to LOWEST priority.
## 3. Depending on each field's `gravity_space_override` mode, combine with
##    or replace the gravity vector accumulated so far:
##      - COMBINE:         accumulated += field_gravity
##      - COMBINE_REPLACE: accumulated += field_gravity, then stop
##                          (ignore any lower priority fields and the
##                          project default gravity).
##      - REPLACE:         accumulated = field_gravity, then stop.
##      - REPLACE_COMBINE: accumulated = field_gravity (discarding whatever
##                          higher priority fields had contributed so far),
##                          but keep processing lower priority fields.
## 4. If processing was never stopped, add the project's default gravity.

func _get_field_areas() -> Array[Area2D]:
	var areas: Array[Area2D] = []
	for child in get_children():
		if child is Area2D:
			areas.append(child)
	return areas

func _rect_half_size(area: Area2D) -> Vector2:
	for child in area.get_children():
		if child is CollisionShape2D and child.shape is RectangleShape2D:
			return (child.shape as RectangleShape2D).size * 0.5
	return Vector2.ZERO

func _area_contains(area: Area2D, world_pos: Vector2) -> bool:
	var half := _rect_half_size(area)
	var local := world_pos - area.global_position
	return absf(local.x) <= half.x and absf(local.y) <= half.y

func _area_gravity_vector(area: Area2D, world_pos: Vector2) -> Vector2:
	if area.gravity_point:
		var center: Vector2 = area.global_position + area.gravity_point_center
		var to_center := center - world_pos
		if area.gravity_point_unit_distance <= 0.0:
			# A unit distance of 0 means constant-magnitude attraction,
			# regardless of how far world_pos is from the point center.
			if to_center.length_squared() <= 0.0:
				return Vector2.ZERO
			return to_center.normalized() * area.gravity
		var dist := to_center.length()
		if dist <= 0.0001:
			return Vector2.ZERO
		var falloff := pow(area.gravity_point_unit_distance / dist, 2.0)
		return to_center.normalized() * area.gravity * falloff
	return area.gravity_direction.normalized() * area.gravity

func net_gravity_at(world_pos: Vector2) -> Vector2:
	var covering: Array[Area2D] = []
	for area in _get_field_areas():
		if area.gravity_space_override != Area2D.SPACE_OVERRIDE_DISABLED and _area_contains(area, world_pos):
			covering.append(area)

	covering.sort_custom(func(a: Area2D, b: Area2D) -> bool: return a.priority > b.priority)

	var gravity := Vector2.ZERO
	var done := false

	for area in covering:
		if done:
			break
		var g := _area_gravity_vector(area, world_pos)
		match area.gravity_space_override:
			Area2D.SPACE_OVERRIDE_COMBINE:
				gravity += g
			Area2D.SPACE_OVERRIDE_COMBINE_REPLACE:
				gravity += g
				done = true
			Area2D.SPACE_OVERRIDE_REPLACE:
				gravity = g
				done = true
			Area2D.SPACE_OVERRIDE_REPLACE_COMBINE:
				gravity = g

	if not done:
		var default_dir: Vector2 = ProjectSettings.get_setting("physics/2d/default_gravity_vector", Vector2(0, 1))
		var default_mag: float = ProjectSettings.get_setting("physics/2d/default_gravity", 980.0)
		gravity += default_dir.normalized() * default_mag

	return gravity
