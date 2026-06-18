extends SceneTree

func _init():
	var val = 0
	var arr = [0]
	var dict = {"val": 0}
	
	var lam = func():
		val += 1
		arr[0] += 1
		dict["val"] += 1
	
	lam.call()
	print("val = ", val)
	print("arr = ", arr[0])
	print("dict = ", dict["val"])
	quit()
