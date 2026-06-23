extends SceneTree

func _init():
    var player = Node.new()
    player.name = "Player"
    
    var anim_player = AnimationPlayer.new()
    anim_player.name = "AnimationPlayer"
    player.add_child(anim_player)
    anim_player.owner = player
    
    var anim_tree = AnimationTree.new()
    anim_tree.name = "AnimationTree"
    player.add_child(anim_tree)
    anim_tree.owner = player
    
    var controller = Node.new()
    controller.name = "PlayerAnimController"
    player.add_child(controller)
    controller.owner = player
    
    var script = load("res://scripts/PlayerAnimController.gd")
    controller.set_script(script)
    
    # Setup animations
    var lib = AnimationLibrary.new()
    
    var anims = ["idle", "walk_north", "walk_south", "walk_east", "walk_west", "attack"]
    for a in anims:
        var anim = Animation.new()
        anim.add_track(Animation.TYPE_VALUE)
        anim.track_set_path(0, NodePath(".:position"))
        anim.track_insert_key(0, 0.0, Vector2(0, 0))
        anim.length = 1.0
        lib.add_animation(a, anim)
        
    anim_player.add_animation_library("", lib)
    
    # Setup AnimationTree
    anim_tree.anim_player = NodePath("../AnimationPlayer")
    
    var sm = AnimationNodeStateMachine.new()
    
    var loco = AnimationNodeBlendSpace2D.new()
    
    var idle_node = AnimationNodeAnimation.new()
    idle_node.animation = &"idle"
    loco.add_blend_point(idle_node, Vector2(0, 0))
    
    var walk_n = AnimationNodeAnimation.new()
    walk_n.animation = &"walk_north"
    loco.add_blend_point(walk_n, Vector2(0, -1))
    
    var walk_s = AnimationNodeAnimation.new()
    walk_s.animation = &"walk_south"
    loco.add_blend_point(walk_s, Vector2(0, 1))
    
    var walk_e = AnimationNodeAnimation.new()
    walk_e.animation = &"walk_east"
    loco.add_blend_point(walk_e, Vector2(1, 0))
    
    var walk_w = AnimationNodeAnimation.new()
    walk_w.animation = &"walk_west"
    loco.add_blend_point(walk_w, Vector2(-1, 0))
    
    sm.add_node("Locomotion", loco)
    
    var attack_node = AnimationNodeAnimation.new()
    attack_node.animation = &"attack"
    sm.add_node("Attack", attack_node)
    
    var trans1 = AnimationNodeStateMachineTransition.new()
    trans1.advance_mode = AnimationNodeStateMachineTransition.ADVANCE_MODE_AUTO
    trans1.advance_condition = &"condition_attack"
    sm.add_transition("Locomotion", "Attack", trans1)
    
    var trans2 = AnimationNodeStateMachineTransition.new()
    trans2.switch_mode = AnimationNodeStateMachineTransition.SWITCH_MODE_AT_END
    trans2.advance_mode = AnimationNodeStateMachineTransition.ADVANCE_MODE_AUTO
    sm.add_transition("Attack", "Locomotion", trans2)
    
    var start_trans = AnimationNodeStateMachineTransition.new()
    start_trans.advance_mode = AnimationNodeStateMachineTransition.ADVANCE_MODE_AUTO
    sm.add_transition("Start", "Locomotion", start_trans)
    
    anim_tree.tree_root = sm
    
    var packed = PackedScene.new()
    packed.pack(player)
    ResourceSaver.save(packed, "res://scenes/Player.tscn")
    
    quit()
