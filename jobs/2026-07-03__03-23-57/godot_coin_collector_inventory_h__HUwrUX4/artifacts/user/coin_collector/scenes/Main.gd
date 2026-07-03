extends Node2D

func _ready() -> void:
    if DisplayServer.get_name() == "headless":
        run_tests()

func run_tests() -> void:
    print("Starting REDACTEDmated integration tests in headless mode...")
    
    # 1. Test initial state
    var player = $Player
    var hud = $HUD
    var coin = $Coin
    
    print("Found nodes: Player=", player, ", HUD=", hud, ", Coin=", coin)
    
    # Reset save file if exists to start fresh
    if FileAccess.file_exists("user://save.json"):
        DirAccess.remove_absolute("user://save.json")
    
    Inventory.coin_count = 0
    
    # Update HUD manually or trigger signal to ensure 0
    Inventory.coin_changed.emit(0)
    
    # Verify HUD label text
    var hud_label = hud.get_node("Label")
    print("Initial HUD label text: ", hud_label.text)
    if hud_label.text != "Coins: 0":
        print("FAIL: HUD label text is not 'Coins: 0'")
        get_tree().quit(1)
        return
        
    # 2. Simulate Coin collection
    print("Simulating coin collection...")
    # Coin is an Area2D. Let's trigger body_entered with player.
    coin._on_body_entered(player)
    
    # Check if Inventory count is updated
    print("Inventory coin count after collection: ", Inventory.get_count())
    if Inventory.get_count() != 1:
        print("FAIL: Inventory count not incremented")
        get_tree().quit(1)
        return
        
    # Verify HUD label updated
    print("HUD label text after collection: ", hud_label.text)
    if hud_label.text != "Coins: 1":
        print("FAIL: HUD label text not updated to 'Coins: 1'")
        get_tree().quit(1)
        return
        
    # 3. Test saving
    print("Testing saving...")
    Inventory.save()
    if not FileAccess.file_exists("user://save.json"):
        print("FAIL: Save file not created")
        get_tree().quit(1)
        return
        
    var file = FileAccess.open("user://save.json", FileAccess.READ)
    var content = file.get_as_text()
    file.close()
    print("Save file content: ", content)
    var data = JSON.parse_string(content)
    if not (data is Dictionary and data.get("count") == 1):
        print("FAIL: Invalid save file content")
        get_tree().quit(1)
        return
        
    # 4. Test loading
    print("Testing loading...")
    Inventory.coin_count = 10
    Inventory.load()
    if Inventory.get_count() != 1:
        print("FAIL: Load failed to restore count")
        get_tree().quit(1)
        return
        
    if hud_label.text != "Coins: 1":
        print("FAIL: HUD label text not restored after load")
        get_tree().quit(1)
        return
        
    print("All REDACTEDmated integration tests passed successfully!")
    get_tree().quit(0)
