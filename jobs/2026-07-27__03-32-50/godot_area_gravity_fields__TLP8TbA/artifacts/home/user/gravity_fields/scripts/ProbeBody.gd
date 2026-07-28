class_name ProbeBody
extends RigidBody2D

## Drives the probe using the exact same gravity resolution as
## FieldController.net_gravity_at(), instead of relying on the engine's
## own (frame-delayed) Area2D overlap bookkeeping. `custom_integrator` is
## enabled so the physics server does not also apply its built-in
## gravity/damping integration on top of this.

const FieldControllerScript = preload("res://scripts/FieldController.gd")

@export var field_controller_path: NodePath

var _field_controller: Node

func _ready() -> void:
	custom_integrator = true
	if field_controller_path != NodePath():
		_field_controller = get_node(field_controller_path)
	if _field_controller == null:
		_field_controller = get_parent()

func _integrate_forces(state: PhysicsDirectBodyState2D) -> void:
	if _field_controller == null:
		return
	var gravity: Vector2 = _field_controller.net_gravity_at(global_position)
	state.linear_velocity += gravity * state.step
