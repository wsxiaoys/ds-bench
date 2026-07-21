# GPU Parallel Prefix-Sum (Scan) and Reduction with a Godot Compute Shader

## Background
Godot 4.4.1 exposes low-level GPU compute through the `RenderingDevice` abstraction. Using a GLSL compute shader you can offload data-parallel work to the GPU and read the results back on the CPU. In this task you will implement a **parallel exclusive prefix-sum (scan)** together with a **sum reduction** over a large integer array, running the arithmetic on the GPU and writing the results to disk from GDScript.

The environment has **no GPU hardware**; a software Vulkan device (Mesa lavapipe) is provided so that a real `RenderingDevice` and compute pipeline are available. The project is launched for you with a rendering driver that makes the `RenderingDevice` available, so you must NOT rely on `--headless` (which disables `RenderingDevice`).

## Requirements
- Create a runnable Godot 4.4.1 project at the project path below.
- Read the input integer array from the provided input file.
- Compute, **on the GPU via a GLSL compute shader executed through a `RenderingDevice`**, both:
  - the **exclusive prefix sum** of the array, and
  - the **total sum** (reduction) of all elements.
- Read the results back to the CPU and write them to the output file as JSON.
- When the project is launched it must perform the computation automatically and then terminate the process on its own.

## Implementation Hints
- Godot version: `4.4.1-stable`.
- Project path: `/home/user/scan` (the file `project.godot` must live directly here, and launching this project must run the computation).
- The scan and reduction MUST be produced by a GPU compute pipeline built from a GLSL compute shader (create a local `RenderingDevice`, upload the data to a storage buffer, dispatch the compute shader, then read the buffer back with `buffer_get_data`). A pure-CPU/GDScript computation of the scan does not satisfy the task.
- Input file: `/home/user/scan/data/input.txt`. It is whitespace-separated ASCII text: the first token is an integer `N` (the element count), followed by exactly `N` non-negative 32-bit integers. Treat every value as a 32-bit integer; the total sum is guaranteed to fit in a signed 32-bit integer. The array is large enough (several thousand elements) that it cannot be scanned correctly by a single GPU workgroup, so a single naive dispatch that assumes all elements live in one workgroup will produce wrong results.
- Output file: `/home/user/scan/output/result.json`. Write a single JSON object (parseable by a standard JSON parser) containing exactly these keys:
  - `count`: the integer `N`.
  - `total`: the integer sum of all input values.
  - `prefix_sum`: a JSON array of exactly `N` integers holding the exclusive scan, defined as `prefix_sum[0] = 0` and `prefix_sum[i] = prefix_sum[i-1] + input[i-1]` for `i` in `1..N-1`. (Consequently `total == prefix_sum[N-1] + input[N-1]`.)
- The GLSL compute shader source must be stored in a file with the `.glsl` extension inside the project.
- Run command (provided in the environment): `godot-run`. This wrapper launches the project at `/home/user/scan` with a software-Vulkan rendering device so that the `RenderingDevice` and compute pipeline are usable. Your project must exit by itself once the output file has been written.

