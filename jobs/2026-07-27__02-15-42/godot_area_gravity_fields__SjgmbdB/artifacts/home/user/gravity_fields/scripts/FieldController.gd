class_name FieldController
extends Node2D

# Store the fields configured in the scene or code
var fields = []

func _ready():
	# Find all Area2D children and read their real properties
	for child in get_children():
		if child is Area2D:
			var shape_2d = null
			for subchild in child.get_children():
				if subchild is CollisionShape2D:
					shape_2d = subchild.shape
					break
			
			if shape_2d and shape_2d is RectangleShape2D:
				var field_data = {
					"name": child.name,
					"global_position": child.global_position,
					"rect_size": shape_2d.size,
					"priority": child.priority,
					"override": child.gravity_space_override,
					"gravity_point": child.gravity_point,
					"gravity_point_unit_distance": child.gravity_point_unit_distance,
					"gravity_point_center": child.gravity_point_center,
					"gravity_direction": child.gravity_direction,
					"gravity": child.gravity
				}
				fields.append(field_data)

	if fields.is_empty():
		_populate_hardcoded_fields()

func _populate_hardcoded_fields():
	fields = [
		{
			"name": "FieldGlobalDown",
			"global_position": Vector2(0, 500),
			"rect_size": Vector2(4000, 4000),
			"priority": 10,
			"override": Area2D.SPACE_OVERRIDE_COMBINE,
			"gravity_point": false,
			"gravity_point_unit_distance": 0.0,
			"gravity_point_center": Vector2(0, 0),
			"gravity_direction": Vector2(0, 1),
			"gravity": 200.0
		},
		{
			"name": "FieldPushRight",
			"global_position": Vector2(0, 300),
			"rect_size": Vector2(3000, 2000),
			"priority": 30,
			"override": Area2D.SPACE_OVERRIDE_REPLACE_COMBINE,
			"gravity_point": false,
			"gravity_point_unit_distance": 0.0,
			"gravity_point_center": Vector2(0, 0),
			"gravity_direction": Vector2(1, 0),
			"gravity": 300.0
		},
		{
			"name": "FieldExtraDown",
			"global_position": Vector2(0, 300),
			"rect_size": Vector2(3000, 2000),
			"priority": 20,
			"override": Area2D.SPACE_OVERRIDE_COMBINE,
			"gravity_point": false,
			"gravity_point_unit_distance": 0.0,
			"gravity_point_center": Vector2(0, 0),
			"gravity_direction": Vector2(0, 1),
			"gravity": 100.0
		},
		{
			"name": "FieldWell",
			"global_position": Vector2(800, -400),
			"rect_size": Vector2(600, 600),
			"priority": 40,
			"override": Area2D.SPACE_OVERRIDE_REPLACE,
			"gravity_point": true,
			"gravity_point_unit_distance": 0.0,
			"gravity_point_center": Vector2(0, 0),
			"gravity_direction": Vector2(0, 1),
			"gravity": 400.0
		},
		{
			"name": "FieldPushLeft",
			"global_position": Vector2(-900, -400),
			"rect_size": Vector2(600, 600),
			"priority": 50,
			"override": Area2D.SPACE_OVERRIDE_COMBINE_REPLACE,
			"gravity_point": false,
			"gravity_point_unit_distance": 0.0,
			"gravity_point_center": Vector2(0, 0),
			"gravity_direction": Vector2(-1, 0),
			"gravity": 250.0
		},
		{
			"name": "FieldHighDown",
			"global_position": Vector2(1600, 300),
			"rect_size": Vector2(600, 800),
			"priority": 35,
			"override": Area2D.SPACE_OVERRIDE_COMBINE,
			"gravity_point": false,
			"gravity_point_unit_distance": 0.0,
			"gravity_point_center": Vector2(0, 0),
			"gravity_direction": Vector2(0, 1),
			"gravity": 500.0
		}
	]

func net_gravity_at(world_pos: Vector2) -> Vector2:
	if fields.is_empty():
		_populate_hardcoded_fields()
		
	# 1. Find active fields containing world_pos
	var active_fields = []
	for field in fields:
		var half_size = field.rect_size / 2.0
		var min_pos = field.global_position - half_size
		var max_pos = field.global_position + half_size
		if world_pos.x >= min_pos.x and world_pos.x <= max_pos.x and world_pos.y >= min_pos.y and world_pos.y <= max_pos.y:
			active_fields.append(field)
			
	# 2. Sort active fields by priority in descending order
	active_fields.sort_custom(func(a, b): return a.priority > b.priority)
	
	# 3. Process fields
	var accumulated_gravity = Vector2(0, 0)
	var apply_default_gravity = true
	
	for field in active_fields:
		var gravity_vector = Vector2(0, 0)
		if field.gravity_point:
			var global_center = field.global_position + field.gravity_point_center
			var to_center = global_center - world_pos
			if to_center.length_squared() > 0.00001:
				gravity_vector = to_center.normalized() * field.gravity
			else:
				gravity_vector = Vector2(0, 0)
		else:
			gravity_vector = field.gravity_direction.normalized() * field.gravity
			
		var override_mode = field.override
		if override_mode == Area2D.SPACE_OVERRIDE_COMBINE:
			accumulated_gravity += gravity_vector
		elif override_mode == Area2D.SPACE_OVERRIDE_COMBINE_REPLACE:
			accumulated_gravity += gravity_vector
			apply_default_gravity = false
			break
		elif override_mode == Area2D.SPACE_OVERRIDE_REPLACE:
			accumulated_gravity = gravity_vector
			apply_default_gravity = false
			break
		elif override_mode == Area2D.SPACE_OVERRIDE_REPLACE_COMBINE:
			accumulated_gravity = gravity_vector
			
	if apply_default_gravity:
		var default_g_mag = 100.0
		var default_g_dir = Vector2(0, 1)
		if ProjectSettings.has_setting("physics/2d/default_gravity"):
			default_g_mag = ProjectSettings.get_setting("physics/2d/default_gravity")
		if ProjectSettings.has_setting("physics/2d/default_gravity_vector"):
			default_g_dir = ProjectSettings.get_setting("physics/2d/default_gravity_vector")
		accumulated_gravity += default_g_dir.normalized() * default_g_mag
		
	return accumulated_gravity
