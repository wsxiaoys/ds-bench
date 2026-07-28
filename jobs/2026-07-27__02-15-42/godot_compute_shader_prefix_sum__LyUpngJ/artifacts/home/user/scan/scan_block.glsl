#version 450

layout(local_size_x = 512) in;

layout(set = 0, binding = 0, std430) readonly buffer InputBuffer {
    uint data[];
} input_data;

layout(set = 0, binding = 1, std430) writeonly buffer OutputBuffer {
    uint data[];
} output_data;

layout(set = 0, binding = 2, std430) writeonly buffer BlockSumsBuffer {
    uint data[];
} block_sums;

layout(push_constant) uniform Params {
    uint N;
    uint pad1;
    uint pad2;
    uint pad3;
} params;

shared uint temp[512];

void main() {
    uint tid = gl_LocalInvocationID.x;
    uint gid = gl_GlobalInvocationID.x;
    uint B = gl_WorkGroupSize.x; // 512

    uint val = 0;
    if (gid < params.N) {
        val = input_data.data[gid];
    }
    temp[tid] = val;
    barrier();

    for (uint stride = 1; stride < B; stride *= 2) {
        uint temp_val = 0;
        if (tid >= stride) {
            temp_val = temp[tid - stride];
        }
        barrier();
        temp[tid] += temp_val;
        barrier();
    }

    // Write block sum (the last element of the inclusive scan of this block)
    if (tid == B - 1) {
        block_sums.data[gl_WorkGroupID.x] = temp[B - 1];
    }

    // Write exclusive scan result
    uint exclusive_val = 0;
    if (tid > 0) {
        exclusive_val = temp[tid - 1];
    }
    if (gid < params.N) {
        output_data.data[gid] = exclusive_val;
    }
}
