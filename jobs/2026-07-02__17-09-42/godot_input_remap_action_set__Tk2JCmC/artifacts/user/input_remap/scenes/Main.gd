extends Control
## Main demo scene — wires up Save / Load / Reset buttons so that the
## runtime remapping helpers are actually exercised.

func _ready() -> void:
	$VBox/SaveBtn.pressed.connect(_on_save_pressed)
	$VBox/LoadBtn.pressed.connect(_on_load_pressed)
	$VBox/ResetBtn.pressed.connect(_on_reset_pressed)

func _on_save_pressed() -> void:
	InputRemapper.save_to_file()

func _on_load_pressed() -> void:
	InputRemapper.load_from_file()

func _on_reset_pressed() -> void:
	InputRemapper.reset_to_defaults()