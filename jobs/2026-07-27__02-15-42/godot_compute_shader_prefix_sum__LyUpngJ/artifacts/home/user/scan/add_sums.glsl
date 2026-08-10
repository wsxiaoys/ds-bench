#version 450

layout(local_size_x = 512) in;

layout(set = 0, binding = 0, std430) buffer OutputBuffer {
    uint data[];
} output_data;

layout(set = 0, binding = 1, std430) readonly buffer ScannedBlockSumsBuffer {
    uint data[];
} scanned_block_sums;

layout(push_constant) uniform Params {
    uint N;
    uint pad1;
    uint pad2;
    uint pad3;
} params;

void main() {
    uint gid = gl_GlobalInvocationID.x;
    if (gid < params.N) {
        output_data.data[gid] += scanned_block_sums.data[gl_WorkGroupID.x];
    }
}
