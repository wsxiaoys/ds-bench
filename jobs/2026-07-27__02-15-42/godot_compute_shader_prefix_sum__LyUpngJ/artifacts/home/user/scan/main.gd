extends Node

func _ready() -> void:
    print("Starting GPU Parallel Prefix-Sum (Scan) and Reduction...")
    run_computation()
    print("Finished. Exiting...")
    get_tree().quit()

func run_computation() -> void:
    # 1. Read input file
    var input_path = "res://data/input.txt"
    if not FileAccess.file_exists(input_path):
        printerr("Input file does not exist at: ", input_path)
        return
        
    var file = FileAccess.open(input_path, FileAccess.READ)
    if not file:
        printerr("Failed to open input file!")
        return
        
    var text = file.get_as_text()
    file.close()
    
    var regex = RegEx.create_from_string("\\S+")
    var tokens: Array[int] = []
    for result in regex.search_all(text):
        tokens.append(result.get_string().to_int())
        
    if tokens.is_empty():
        printerr("No tokens found in input file!")
        return
        
    var N = tokens[0]
    print("N = ", N)
    if tokens.size() < N + 1:
        printerr("Error: Input file has fewer elements than N!")
        return
        
    var input_array = PackedInt32Array()
    input_array.resize(N)
    for i in range(N):
        input_array[i] = tokens[i + 1]
        
    # 2. Setup RenderingDevice
    var rd := RenderingServer.create_local_rendering_device()
    if not rd:
        printerr("Failed to create local rendering device!")
        return
        
    # 3. Compile shaders
    var scan_shader = compile_shader("res://scan_block.glsl", rd)
    if not scan_shader.is_valid():
        printerr("Failed to compile scan shader!")
        return
        
    var add_shader = compile_shader("res://add_sums.glsl", rd)
    if not add_shader.is_valid():
        printerr("Failed to compile add shader!")
        return
        
    # 4. Allocate buffers
    var B = 512
    var num_blocks = (N + B - 1) / B
    print("Number of blocks: ", num_blocks)
    
    # Input Buffer
    var input_bytes = input_array.to_byte_array()
    var input_buffer = rd.storage_buffer_create(input_bytes.size(), input_bytes)
    
    # Output Buffer
    var output_array = PackedInt32Array()
    output_array.resize(N)
    var output_bytes = output_array.to_byte_array()
    var output_buffer = rd.storage_buffer_create(output_bytes.size(), output_bytes)
    
    # Block Sums Buffer
    var block_sums_array = PackedInt32Array()
    block_sums_array.resize(num_blocks)
    var block_sums_bytes = block_sums_array.to_byte_array()
    var block_sums_buffer = rd.storage_buffer_create(block_sums_bytes.size(), block_sums_bytes)
    
    # Scanned Block Sums Buffer
    var scanned_block_sums_array = PackedInt32Array()
    scanned_block_sums_array.resize(num_blocks)
    var scanned_block_sums_bytes = scanned_block_sums_array.to_byte_array()
    var scanned_block_sums_buffer = rd.storage_buffer_create(scanned_block_sums_bytes.size(), scanned_block_sums_bytes)
    
    # Total Sum Buffer
    var total_sum_array = PackedInt32Array([0])
    var total_sum_bytes = total_sum_array.to_byte_array()
    var total_sum_buffer = rd.storage_buffer_create(total_sum_bytes.size(), total_sum_bytes)
    
    # 5. Create Pipelines
    var scan_pipeline = rd.compute_pipeline_create(scan_shader)
    var add_pipeline = rd.compute_pipeline_create(add_shader)
    
    # 6. Create Uniform Sets
    # Pass 1 Uniform Set
    var uniform_set1_list: Array[RDUniform] = []
    
    var u_input := RDUniform.new()
    u_input.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_input.binding = 0
    u_input.add_id(input_buffer)
    uniform_set1_list.append(u_input)
    
    var u_output := RDUniform.new()
    u_output.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_output.binding = 1
    u_output.add_id(output_buffer)
    uniform_set1_list.append(u_output)
    
    var u_block_sums := RDUniform.new()
    u_block_sums.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_block_sums.binding = 2
    u_block_sums.add_id(block_sums_buffer)
    uniform_set1_list.append(u_block_sums)
    
    var uniform_set1 = rd.uniform_set_create(uniform_set1_list, scan_shader, 0)
    
    # Pass 2 Uniform Set
    var uniform_set2_list: Array[RDUniform] = []
    
    var u_block_sums_in := RDUniform.new()
    u_block_sums_in.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_block_sums_in.binding = 0
    u_block_sums_in.add_id(block_sums_buffer)
    uniform_set2_list.append(u_block_sums_in)
    
    var u_scanned_block_sums := RDUniform.new()
    u_scanned_block_sums.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_scanned_block_sums.binding = 1
    u_scanned_block_sums.add_id(scanned_block_sums_buffer)
    uniform_set2_list.append(u_scanned_block_sums)
    
    var u_total_sum := RDUniform.new()
    u_total_sum.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_total_sum.binding = 2
    u_total_sum.add_id(total_sum_buffer)
    uniform_set2_list.append(u_total_sum)
    
    var uniform_set2 = rd.uniform_set_create(uniform_set2_list, scan_shader, 0)
    
    # Pass 3 Uniform Set
    var uniform_set3_list: Array[RDUniform] = []
    
    var u_output_rw := RDUniform.new()
    u_output_rw.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_output_rw.binding = 0
    u_output_rw.add_id(output_buffer)
    uniform_set3_list.append(u_output_rw)
    
    var u_scanned_block_sums_ro := RDUniform.new()
    u_scanned_block_sums_ro.uniform_type = RenderingDevice.UNIFORM_TYPE_STORAGE_BUFFER
    u_scanned_block_sums_ro.binding = 1
    u_scanned_block_sums_ro.add_id(scanned_block_sums_buffer)
    uniform_set3_list.append(u_scanned_block_sums_ro)
    
    var uniform_set3 = rd.uniform_set_create(uniform_set3_list, add_shader, 0)
    
    # 7. Dispatches
    # Pass 1: Local Scan
    var compute_list = rd.compute_list_begin()
    rd.compute_list_bind_compute_pipeline(compute_list, scan_pipeline)
    rd.compute_list_bind_uniform_set(compute_list, uniform_set1, 0)
    var push_constant1 = PackedInt32Array([N, 0, 0, 0]).to_byte_array()
    rd.compute_list_set_push_constant(compute_list, push_constant1, push_constant1.size())
    rd.compute_list_dispatch(compute_list, num_blocks, 1, 1)
    rd.compute_list_end()
    rd.submit()
    rd.sync()
    
    # Pass 2: Scan block sums
    compute_list = rd.compute_list_begin()
    rd.compute_list_bind_compute_pipeline(compute_list, scan_pipeline)
    rd.compute_list_bind_uniform_set(compute_list, uniform_set2, 0)
    var push_constant2 = PackedInt32Array([num_blocks, 0, 0, 0]).to_byte_array()
    rd.compute_list_set_push_constant(compute_list, push_constant2, push_constant2.size())
    rd.compute_list_dispatch(compute_list, 1, 1, 1)
    rd.compute_list_end()
    rd.submit()
    rd.sync()
    
    # Pass 3: Add block sums
    compute_list = rd.compute_list_begin()
    rd.compute_list_bind_compute_pipeline(compute_list, add_pipeline)
    rd.compute_list_bind_uniform_set(compute_list, uniform_set3, 0)
    var push_constant3 = PackedInt32Array([N, 0, 0, 0]).to_byte_array()
    rd.compute_list_set_push_constant(compute_list, push_constant3, push_constant3.size())
    rd.compute_list_dispatch(compute_list, num_blocks, 1, 1)
    rd.compute_list_end()
    rd.submit()
    rd.sync()
    
    # 8. Read back results
    var output_res_bytes = rd.buffer_get_data(output_buffer)
    var final_prefix_sum = output_res_bytes.to_int32_array()
    
    var total_sum_res_bytes = rd.buffer_get_data(total_sum_buffer)
    var final_total_sum_arr = total_sum_res_bytes.to_int32_array()
    var final_total_sum = final_total_sum_arr[0]
    
    print("Total Sum computed: ", final_total_sum)
    print("First few prefix sums: ", final_prefix_sum.slice(0, min(10, N)))
    
    # 9. Write Output JSON
    var output_dir = "res://output"
    if not DirAccess.dir_exists_absolute(output_dir):
        DirAccess.make_dir_absolute(output_dir)
        
    var output_path = "res://output/result.json"
    var save_file = FileAccess.open(output_path, FileAccess.WRITE)
    if save_file:
        var output_data = {
            "count": N,
            "total": final_total_sum,
            "prefix_sum": Array(final_prefix_sum)
        }
        var json_string = JSON.stringify(output_data)
        save_file.store_string(json_string)
        save_file.close()
        print("Successfully wrote result to: ", output_path)
    else:
        printerr("Failed to open output file for writing: ", output_path)
        
    # 10. Cleanup RIDs
    # Free uniform sets first
    rd.free_rid(uniform_set1)
    rd.free_rid(uniform_set2)
    rd.free_rid(uniform_set3)
    
    # Free pipelines and shaders
    rd.free_rid(scan_pipeline)
    rd.free_rid(add_pipeline)
    rd.free_rid(scan_shader)
    rd.free_rid(add_shader)
    
    # Free buffers
    rd.free_rid(input_buffer)
    rd.free_rid(output_buffer)
    rd.free_rid(block_sums_buffer)
    rd.free_rid(scanned_block_sums_buffer)
    rd.free_rid(total_sum_buffer)

func compile_shader(path: String, rd: RenderingDevice) -> RID:
    var file = FileAccess.open(path, FileAccess.READ)
    if not file:
        printerr("Failed to open shader file: ", path)
        return RID()
    var code = file.get_as_text()
    file.close()
    
    var shader_source := RDShaderSource.new()
    shader_source.language = RenderingDevice.SHADER_LANGUAGE_GLSL
    shader_source.source_compute = code
    
    var spirv := rd.shader_compile_spirv_from_source(shader_source)
    if not spirv.compile_error_compute.is_empty():
        printerr("Shader compile error in ", path, ": ", spirv.compile_error_compute)
        return RID()
    
    var shader = rd.shader_create_from_spirv(spirv)
    return shader
