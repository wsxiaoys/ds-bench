import pytest
from datetime import datetime, timedelta
from run import DeduplicateLogic, build_deduplicate_logic, create_dataflow
import bytewax.operators as op
from bytewax.dataflow import Dataflow
from bytewax.testing import TestingSource, TestingSink, run_main


def test_deduplicate_logic_direct():
    logic = DeduplicateLogic(None)

    # First event: e1 at 12:00:00 - should emit
    ev1 = {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:00Z"}
    out1, discard1 = logic.on_item(ev1)
    assert out1 == [ev1]
    assert discard1 is DeduplicateLogic.RETAIN
    assert "e1" in logic.state

    # Second event: e1 at 12:00:05 (within 10s) - should drop
    ev2 = {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:05Z"}
    out2, discard2 = logic.on_item(ev2)
    assert out2 == []
    assert discard2 is DeduplicateLogic.RETAIN

    # Third event: e1 at 12:00:10 (exactly 10s) - should drop
    ev3 = {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:10Z"}
    out3, discard3 = logic.on_item(ev3)
    assert out3 == []

    # Fourth event: e1 at 12:00:11 (strictly after 10s) - should emit
    ev4 = {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:11Z"}
    out4, discard4 = logic.on_item(ev4)
    assert out4 == [ev4]
    assert logic.state["e1"] == datetime.fromisoformat("2023-01-01T12:00:11Z")


def test_deduplicate_logic_cleanup():
    logic = DeduplicateLogic(None)

    # Emit e1 at 12:00:00
    ev1 = {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:00Z"}
    logic.on_item(ev1)
    assert "e1" in logic.state

    # Emit e2 at 12:00:11 (current timestamp is 12:00:11, which is > 10s after e1's timestamp)
    # This should trigger cleanup of e1.
    ev2 = {"user_id": "u1", "event_id": "e2", "timestamp": "2023-01-01T12:00:11Z"}
    out2, _ = logic.on_item(ev2)
    assert out2 == [ev2]
    assert "e1" not in logic.state
    assert "e2" in logic.state


def test_bytewax_dataflow_e2e():
    flow = Dataflow("test_flow")
    
    input_events = [
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:00Z"},
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:05Z"},
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:10Z"},
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:11Z"},
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:15Z"},
        {"user_id": "u1", "event_id": "e2", "timestamp": "2023-01-01T12:00:25Z"},
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:26Z"},
        {"user_id": "u2", "event_id": "e1", "timestamp": "2023-01-01T12:00:00Z"},
    ]
    
    source = TestingSource(input_events)
    raw_stream = op.input("input_step", flow, source)
    keyed_stream = op.key_on("key_by_user", raw_stream, lambda x: x["user_id"])
    dedup_stream = op.stateful("deduplicate", keyed_stream, build_deduplicate_logic)
    
    output_list = []
    op.output("output_step", dedup_stream, TestingSink(output_list))
    
    run_main(flow)
    
    emitted_events = [val for key, val in output_list]
    
    expected_events = [
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:00Z"},
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:11Z"},
        {"user_id": "u1", "event_id": "e2", "timestamp": "2023-01-01T12:00:25Z"},
        {"user_id": "u1", "event_id": "e1", "timestamp": "2023-01-01T12:00:26Z"},
        {"user_id": "u2", "event_id": "e1", "timestamp": "2023-01-01T12:00:00Z"},
    ]
    
    assert emitted_events == expected_events
