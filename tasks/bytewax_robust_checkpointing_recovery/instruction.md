# Bytewax Stateful Pipeline with Recovery

## Background
Bytewax is a stateful stream processing framework. In this task, you will build a Bytewax dataflow that processes an input stream of key-value pairs, maintains a stateful running maximum for each key, and persists its state using Bytewax's recovery mechanisms.

## Requirements
- The project must be located in `/home/user/bytewax_recovery`.
- Create a Bytewax dataflow that reads an input CSV file containing `key,value` pairs (where `value` is an integer).
- Compute the running maximum of the `value` for each `key` using a stateful operator.
- Write the results to an output file in the format `key,running_max` for each processed event.
- Enable Bytewax's local SQLite-based recovery system so that the pipeline's state is persisted to a specified recovery directory.
- Ensure that if the pipeline is run sequentially multiple times with the same recovery directory but different input files, the state (running maximums) is correctly recovered and maintained across runs.

## Implementation Hints
- Use `bytewax.connectors.files.FileSource` and `FileSink` (or similar standard Bytewax connectors) for file I/O.
- Use a stateful operator like `stateful_map` to maintain the maximum value seen so far for each key.
- Remember that stateful operators require a unique `step_id` for recovery to work properly.
- Your entrypoint must be a shell script `run.sh` located at `/home/user/bytewax_recovery/run.sh`.
- The script must accept arguments in the exact order: `bash run.sh <input_file> <output_file> <recovery_dir>`. It should invoke the Bytewax dataflow with the appropriate recovery flags (e.g., using `python -m bytewax.run` or equivalent CLI commands with `-r`, `-s`, `-b` flags as needed).

