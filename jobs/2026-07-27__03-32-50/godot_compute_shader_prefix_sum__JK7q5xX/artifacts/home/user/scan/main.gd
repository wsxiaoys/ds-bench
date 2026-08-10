extends Node

const BLOCK_SIZE := 256

const INPUT_PATH := "res://data/input.txt"
const OUTPUT_DIR := "res://output"
const OUTPUT_PATH := "res://output/result.json"

func _ready() -> void:
	var err := run()
	if err != OK:
		push_error("scan computation failed with error code: %d" % err)
	get_tree().quit()

func run() -> int:
	# ---- 1. Read input -------------------------------------------------
	var file := FileAccess.open(INPUT_PATH, FileAccess.READ)
	if file == null:
		push_error("Could not open input file: %s" % INPUT_PATH)
		return ERR_FILE_NOT_FOUND

	var text := file.get_as_text()
	file.close()

	# Split on any whitespace (spaces, tabs, newlines, CR).
	var tokens := PackedStringArray()
	for piece in text.split("\n"):
		for sub in piece.split(" "):
			var trimmed := sub.strip_edges()
			if trimmed != "":
				tokens.append(trimmed)

	if tokens.size() < 1:
		push_error("Input file is empty")
		return ERR_PARSE_ERROR

	var n := int(tokens[0])
	if tokens.size() < n + 1:
		push_error("Input file does not contain %d elements" % n)
		return ERR_PARSE_ERROR

	var input_data := PackedInt32Array()
	input_data.resize(n)
	for i in range(n):
		input_data[i] = int(tokens[i + 1])

	# ---- 2. Pad to a multiple of BLOCK_SIZE -----------------------------
	var num_blocks := int(ceil(float(n) / float(BLOCK_SIZE)))
	if num_blocks < 1:
		num_blocks = 1
	var padded_size := num_blocks * BLOCK_SIZE

	var padded_input := PackedInt32Array()
	padded_input.resize(padded_size)
	for i in range(padded_size):
		padded_input[i] = input_data[i] if i < n else 0

	# ---- 3. Set up the local RenderingDevice ---------------------------
	var rd := RenderingServer.create_local_rendering_device()
	if rd == null:
		push_error("RenderingDevice is not available on this platform/run")
		return ERR_UNAVAILABLE

	var block_scan_shader := _load_shader(rd, "res://shaders/block_scan.glsl")
	var block_sum_scan_shader := _load_shader(rd, "res://shaders/block_sum_scan.glsl")
	var add_offsets_shader := _load_shader(rd, "res://shaders/add_offsets.glsl")

	# ---- 4. Create buffers ---------------------------------------------
	var input_bytes := padded_input.to_byte_array()
	var input_buf := rd.storage_buffer_create(input_bytes.size(), input_bytes)

	var local_scan_buf := rd.storage_buffer_create(padded_size * 4, _zero_bytes(padded_size * 4))
	var block_sums_buf := rd.storage_buffer_create(num_blocks * 4, _zero_bytes(num_blocks * 4))
	var block_offsets_buf := rd.storage_buffer_create(num_blocks * 4, _zero_bytes(num_blocks * 4))
	var total_buf := rd.storage_buffer_create(4, _zero_bytes(4))
	var output_buf := rd.storage_buffer_create(padded_size * 4, _zero_bytes(padded_size * 4))

	# ---- 5. Pass 1: per-block local exclusive scan + block sums --------
	var pass1_set := rd.uniform_set_create([
		_make_uniform(0, input_buf),
		_make_uniform(1, local_scan_buf),
		_make_uniform(2, block_sums_buf),
	], block_scan_shader, 0)
	var pass1_pipeline := rd.compute_pipeline_create(block_scan_shader)
	_dispatch(rd, pass1_pipeline, pass1_set, num_blocks, PackedByteArray())

	# ---- 6. Pass 2: exclusive scan of block sums + grand total ---------
	var pass2_set := rd.uniform_set_create([
		_make_uniform(0, block_sums_buf),
		_make_uniform(1, block_offsets_buf),
		_make_uniform(2, total_buf),
	], block_sum_scan_shader, 0)
	var pass2_pipeline := rd.compute_pipeline_create(block_sum_scan_shader)
	var push_constant := PackedInt32Array([num_blocks, 0, 0, 0]).to_byte_array()
	_dispatch(rd, pass2_pipeline, pass2_set, 1, push_constant)

	# ---- 7. Pass 3: add block offsets to local scan ---------------------
	var pass3_set := rd.uniform_set_create([
		_make_uniform(0, local_scan_buf),
		_make_uniform(1, block_offsets_buf),
		_make_uniform(2, output_buf),
	], add_offsets_shader, 0)
	var pass3_pipeline := rd.compute_pipeline_create(add_offsets_shader)
	_dispatch(rd, pass3_pipeline, pass3_set, num_blocks, PackedByteArray())

	# ---- 8. Read back results --------------------------------------------
	var output_bytes := rd.buffer_get_data(output_buf)
	var prefix_sum_padded := output_bytes.to_int32_array()

	var total_bytes := rd.buffer_get_data(total_buf)
	var total_arr := total_bytes.to_int32_array()
	var total: int = total_arr[0]

	var prefix_sum := PackedInt32Array()
	prefix_sum.resize(n)
	for i in range(n):
		prefix_sum[i] = prefix_sum_padded[i]

	rd.free()

	# ---- 9. Write JSON output --------------------------------------------
	var dir := DirAccess.open("res://")
	if dir:
		dir.make_dir_recursive("output")

	var result := {
		"count": n,
		"total": total,
		"prefix_sum": Array(prefix_sum),
	}

	var out_file := FileAccess.open(OUTPUT_PATH, FileAccess.WRITE)
	if out_file == null:
		push_error("Could not open output file for writing: %s" % OUTPUT_PATH)
		return ERR_FILE_CANT_WRITE
	out_file.store_string(JSON.stringify(result))
	out_file.close()

	print("Scan complete. n=%d total=%d" % [n, total])
	return OK

func _load_shader(rd: RenderingDevice, path: String) -> RID:
	var shader_file: RDShaderFile = load(path)
	var spirv: RDShaderSPIRV = shader_file.get_spirv()
	return rd.shader_create_from_spirv(spirv)

func _zero_bytes(size: int) -> PackedByteArray:
	var b := PackedByteArray()
	b.resize(size)
	return b

func _make_uniform(binding: int, buffer: RID) -> RDUniform:
	var u := RDUniform.new()
	u.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
	u.binding = binding
	u.add_id(buffer)
	return u

func _dispatch(rd: RenderingDevice, pipeline: RID, uniform_set: RID, groups_x: int, push_constant: PackedByteArray) -> void:
	var compute_list := rd.compute_list_begin()
	rd.compute_list_bind_compute_pipeline(compute_list, pipeline)
	rd.compute_list_bind_uniform_set(compute_list, uniform_set, 0)
	if push_constant.size() > 0:
		rd.compute_list_set_push_constant(compute_list, push_constant, push_constant.size())
	rd.compute_list_dispatch(compute_list, groups_x, 1, 1)
	rd.compute_list_end()
	rd.submit()
	rd.sync()
