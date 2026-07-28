#[compute]
#version 450

// Pass 2: exclusive-scan the (small) array of per-block sums produced by
// pass 1, and also emit the grand total. The number of blocks is small
// enough (padded_size / BLOCK_SIZE) that a single invocation handles it
// sequentially on the GPU.

layout(local_size_x = 1) in;

layout(set = 0, binding = 0, std430) restrict readonly buffer BlockSumBuffer {
    int data[];
}
block_sums;

layout(set = 0, binding = 1, std430) restrict writeonly buffer BlockOffsetBuffer {
    int data[];
}
block_offsets;

layout(set = 0, binding = 2, std430) restrict writeonly buffer TotalBuffer {
    int value;
}
total_buf;

layout(push_constant, std430) uniform Params {
    uint num_blocks;
    uint pad0;
    uint pad1;
    uint pad2;
}
params;

void main() {
    int running = 0;
    for (uint i = 0u; i < params.num_blocks; i++) {
        block_offsets.data[i] = running;
        running += block_sums.data[i];
    }
    total_buf.value = running;
}
