extends SceneTree

func _init():
    process_frame.connect(_on_ready)

func _on_ready():
    var player_scene = load("res://scenes/Player.tscn")
    var player = player_scene.instantiate()
    root.add_child(player)
    
    var tree = player.get_node("AnimationTree")
    tree.active = true
    
    var controller = player.get_node("PlayerAnimController")
    
    print("Initial state: ", controller.current_state())
    
    controller.set_move_input(Vector2(1, 0))
    print("Blend pos: ", tree.get("parameters/Locomotion/blend_position"))
    
    controller.trigger_attack()
    print("Condition attack: ", tree.get("parameters/conditions/condition_attack"))
    
    # Process a few frames
    for i in range(3):
        tree.advance(0.1)
        print("Frame ", i, " state: ", controller.current_state())
        if controller.has_method("_process"):
            controller._process(0.1)
            
    quit()
