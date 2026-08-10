#[compute]
#version 450

// Pass 1: per-block inclusive scan (Hillis-Steele) in shared memory, then
// converted to an exclusive local scan. Also emits the total sum of each
// block so a second pass can compute the cross-block offsets.

#define BLOCK_SIZE 256

layout(local_size_x = BLOCK_SIZE) in;

layout(set = 0, binding = 0, std430) restrict readonly buffer InputBuffer {
    int data[];
}
input_buf;

layout(set = 0, binding = 1, std430) restrict writeonly buffer LocalScanBuffer {
    int data[];
}
local_scan;

layout(set = 0, binding = 2, std430) restrict writeonly buffer BlockSumBuffer {
    int data[];
}
block_sums;

shared int temp[BLOCK_SIZE];

void main() {
    uint tid = gl_LocalInvocationID.x;
    uint gid = gl_GlobalInvocationID.x;
    uint block_id = gl_WorkGroupID.x;

    int original = input_buf.data[gid];
    temp[tid] = original;
    barrier();

    // Hillis-Steele inclusive scan within the block.
    for (uint offset = 1u; offset < uint(BLOCK_SIZE); offset <<= 1u) {
        int val = 0;
        bool has = tid >= offset;
        if (has) {
            val = temp[tid - offset];
        }
        barrier();
        if (has) {
            temp[tid] += val;
        }
        barrier();
    }

    int inclusive = temp[tid];
    local_scan.data[gid] = inclusive - original;

    if (tid == uint(BLOCK_SIZE - 1)) {
        block_sums.data[block_id] = inclusive;
    }
}
