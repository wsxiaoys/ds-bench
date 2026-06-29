# Multi-Stage Aggregation in Bytewax

## Background
Bytewax is a distributed stream processing framework. When dealing with high-volume data, computing a global aggregate directly can create a bottleneck on a single worker. A common pattern is Multi-Stage Aggregation: first aggregate data locally by a partition key (e.g., `sensor_id`), and then perform a global aggregation on the reduced results.

## Requirements
- Working within the project directory `/home/user/bytewax_project`, create a Bytewax dataflow in `pipeline.py`.
- Name the dataflow object `flow`, so that it can be executed using the command: `python -m bytewax.run pipeline:flow`.
- The dataflow must read a finite stream of sensor readings from a JSONL file named `input.jsonl` located in the project directory.
- Each line in `input.jsonl` is a JSON object: `{"sensor_id": string, "val": number}`.
- **Stage 1 (Local Aggregation)**: Group the stream by `sensor_id` and calculate the sum of `val` for each sensor. Since this is a finite stream, use the appropriate operator that emits the final result when the upstream completes.
- **Stage 2 (Global Aggregation)**: Take the output of Stage 1, re-key all items to a single global key `"global"`, and calculate the grand total sum of all sensor values using a final aggregation operator.
- Output the final grand total to standard output.

## Implementation Hints
- Use `bytewax.connectors.files.FileSource` or a custom `TestingSource` / `DynamicSource` to read the JSONL file line by line and parse it into dictionaries.
- Remember that stateful operators in Bytewax require a `KeyedStream` (a stream of `(string_key, value)` tuples).
- You will need to map the parsed JSON objects into `(sensor_id, val)` tuples before the first aggregation.
- Use `op.reduce_final` or `op.fold_final` to aggregate finite streams.
- After the first aggregation, map the stream to `("global", local_sum)` to prepare it for the global aggregation.
- Use `StdOutSink` to print the final result to standard output, which will naturally output the result in the format: `('global', <grand_total>)`.

