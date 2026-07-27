# Transactional Partitioned Sink with Exactly-Once Recovery (Bytewax)

## Background
You are building a fault-tolerant streaming pipeline with **Bytewax** (v0.21.1), a Python-native stateful stream processor. Bytewax can snapshot the internal state of a dataflow into a set of SQLite recovery partitions and resume from the most recent consistent snapshot after a failure. Because snapshotting is periodic, records may be *replayed* after a crash, so any output destination must be designed to be idempotent to achieve exactly-once output.

Your job is to build a stateful aggregation pipeline whose results are written through a **custom partitioned sink** that guarantees each input event is written to disk exactly once, even across a crash and a recovered restart.

## Requirements
- Implement a Bytewax dataflow in `dataflow.py` that exposes a module-level `bytewax.dataflow.Dataflow` object named `flow`.
- Read input events from `events.json`: a JSON array of objects, each with integer `seq`, string `key`, and integer `value`.
- Maintain, per `key`, a stateful cumulative running sum of `value` processed in ascending `seq` order.
- Write the aggregated results through a **custom partitioned output sink that you implement** (a `bytewax.outputs.FixedPartitionedSink` backed by a `bytewax.outputs.StatefulSinkPartition`) into per-partition local files.
- The sink must deliver **exactly-once / idempotent** output across recovery: after the pipeline crashes part-way through and is then restarted against the same recovery directory, every input event must appear in the output **exactly once** (no duplicates, no omissions), with correct aggregation values.
- Records must be durably written as they are processed, so that a crash cannot lose already-written records and a recovered restart cannot duplicate them.

## Implementation Hints
- Project path: `/home/user/project`
- Dataflow entry point: `dataflow.py` exposing a top-level object named `flow`. It will be run as `dataflow:flow`.
- Input file: `/home/user/project/events.json` (already present).
- Output location: a directory named `out/` inside the project directory; create it if it does not exist.
- Output layout: results are spread across exactly 4 partitions written to files named `part-0.jsonl`, `part-1.jsonl`, `part-2.jsonl`, and `part-3.jsonl` inside `out/` (a partition file may be empty or absent if no record routes to it). Each line of a partition file is one JSON object containing **exactly** the keys `seq`, `key`, `value`, and `running_total`.
- Partition routing rule: a record whose key is `K` must be written to the partition whose index is `zlib.adler32(K.encode("utf-8")) % 4` (i.e. the file `out/part-<index>.jsonl`). All records sharing a key therefore land in a single partition file.
- `running_total` of an output record equals the sum of `value` across all events that share the same `key` and have `seq` less than or equal to that record's `seq`.
- Within any single partition file, the records belonging to a given key must appear in ascending `seq` order.
- Reproducible-failure hook (required so the crash can be triggered deterministically): when the environment variable `CRASH_AT` is set to an integer `N`, the pipeline MUST terminate with a non-zero exit status upon reaching the event whose `seq == N`, and all events with `seq < N` must already be durably written to their partition files before the process exits; when `CRASH_AT` is unset (or empty), the pipeline MUST process every event and exit with status 0.
- The pipeline will be executed with recovery enabled. The tests initialize recovery with `python -m bytewax.recovery <recovery_dir> 4` and then run `python -m bytewax.run dataflow:flow -r <recovery_dir> -s 1000 -b 0`, using the **same** recovery directory first for the crashing run (with `CRASH_AT` set) and then for the recovering run (with `CRASH_AT` unset).
- Pin `bytewax==0.21.1`.

## Verification
Your solution passes when, after a crashing run followed by a recovering run against the same recovery directory, the union of the partition files contains every input event exactly once, each record is in the correct partition, and every `running_total` is correct.
