#[compute]
#version 450

// Pass 3: add each block's exclusive offset (from pass 2) to the local
// exclusive scan computed in pass 1, producing the final exclusive prefix
// sum for the whole (padded) array.

#define BLOCK_SIZE 256

layout(local_size_x = BLOCK_SIZE) in;

layout(set = 0, binding = 0, std430) restrict readonly buffer LocalScanBuffer {
    int data[];
}
local_scan;

layout(set = 0, binding = 1, std430) restrict readonly buffer BlockOffsetBuffer {
    int data[];
}
block_offsets;

layout(set = 0, binding = 2, std430) restrict writeonly buffer OutputBuffer {
    int data[];
}
output_buf;

void main() {
    uint gid = gl_GlobalInvocationID.x;
    uint block_id = gl_WorkGroupID.x;
    output_buf.data[gid] = local_scan.data[gid] + block_offsets.data[block_id];
}
