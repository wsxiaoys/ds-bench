"""Stateful moving-average pipeline built with Bytewax.

Reads sensor readings (``sensor_id,temperature``) from ``input.csv`` in
the current directory, computes the moving average of the last 3
temperature readings per sensor (or the average of the available
readings when fewer than 3 have been seen) using Bytewax's stateful
processing, and writes ``sensor_id,moving_average`` lines to
``output.csv``.

Run with::

    python -m bytewax.run pipeline:flow
"""

from collections import deque
from pathlib import Path

from bytewax.dataflow import Dataflow
from bytewax import operators as op
from bytewax.connectors.files import FileSource, FileSink

# How many of the most recent readings contribute to the moving average.
WINDOW_SIZE = 3

INPUT_PATH = Path("input.csv")
OUTPUT_PATH = Path("output.csv")


def parse_line(line: str) -> tuple[str, float]:
    """Parse a ``sensor_id,temperature`` line into a ``(sensor_id, temp)`` tuple.

    Blank lines are rejected upstream, so we only expect well-formed
    rows here. Keys are kept as strings (as required by Bytewax).
    """
    sensor_id, temperature = line.split(",", 1)
    return sensor_id.strip(), float(temperature)


def moving_average(
    state: deque[float] | None, value: tuple[str, float]
) -> tuple[deque[float], float]:
    """Stateful mapper computing the moving average over the last readings.

    :arg state: A deque of the most recent temperatures (up to
        ``WINDOW_SIZE``) or ``None`` the first time a key is seen.
    :arg value: The keyed upstream value ``(sensor_id, temperature)``.
    :returns: A 2-tuple of ``(new_state, emit_value)``. A brand-new
        deque is returned every call so that recovery snapshots never
        observe an in-place mutation.
    """
    _sensor_id, temperature = value

    # Always build a fresh deque so the previous state object is left
    # untouched (important for Bytewax's recovery/snapshot semantics).
    if state is None:
        new_state: deque[float] = deque(maxlen=WINDOW_SIZE)
    else:
        new_state = deque(state, maxlen=WINDOW_SIZE)

    new_state.append(temperature)
    average = sum(new_state) / len(new_state)
    return new_state, average


def format_output(item: tuple[str, float]) -> tuple[str, str]:
    """Format a keyed ``(sensor_id, average)`` item for the file sink.

    Returns a ``(key, line)`` tuple because ``FileSink`` is a
    fixed-partitioned sink that routes on the key and writes the value.
    """
    sensor_id, average = item
    return sensor_id, f"{sensor_id},{average:.2f}"


# ---------------------------------------------------------------------------
# Dataflow definition
# ---------------------------------------------------------------------------

flow = Dataflow("moving_average")

# 1. Read raw ``sensor_id,temperature`` lines from input.csv.
lines = op.input("read", flow, FileSource(INPUT_PATH))

# 2. Drop any empty lines (e.g. a trailing newline at EOF).
lines = op.filter("skip_blank", lines, lambda line: line.strip() != "")

# 3. Parse each line into ``(sensor_id, temperature)``.
readings = op.map("parse", lines, parse_line)

# 4. Key the stream by sensor_id so stateful_map tracks state per sensor.
keyed = op.key_on("key_on_sensor", readings, lambda r: r[0])

# 5. Statefully compute the moving average of the last WINDOW_SIZE readings.
averages = op.stateful_map("moving_average", keyed, moving_average)

# 6. Format each keyed ``(sensor_id, average)`` into a CSV output line,
#    keeping the key so FileSink can route the item.
formatted = op.map("format", averages, format_output)

# 7. Write the formatted lines to output.csv.
op.output("write", formatted, FileSink(OUTPUT_PATH))