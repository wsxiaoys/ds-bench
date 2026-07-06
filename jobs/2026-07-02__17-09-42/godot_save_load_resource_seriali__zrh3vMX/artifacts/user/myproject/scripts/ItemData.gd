class_name ItemData
extends Resource

## A single inventory item stored inside a [GameSaveData]'s inventory array.
##
## Custom [Resource] subclass used as an inline sub-resource.  Declaring
## [code]class_name ItemData[/code] lets [ResourceSaver] / [ResourceLoader]
## recognise the type and (de)serialise it inside both the text
## ([code].tres[/code]) and binary ([code].res[/code]) formats.

@export var id: String = ""
@export var quantity: int = 0
@export var rarity: int = 0
