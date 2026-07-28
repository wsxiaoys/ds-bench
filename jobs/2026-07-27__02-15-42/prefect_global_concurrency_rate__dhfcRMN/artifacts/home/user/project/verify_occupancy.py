import json

def verify_log():
    log_file = "/home/user/project/occupancy.jsonl"
    
    events = []
    with open(log_file, "r") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except Exception as e:
                print(f"Error: Line {line_num} is not valid JSON: {line}")
                return False
            
            # Check keys
            expected_keys = {"event", "unit", "ts"}
            if set(data.keys()) != expected_keys:
                print(f"Error: Line {line_num} does not have expected keys {expected_keys}. Found: {list(data.keys())}")
                return False
            
            # Check values
            if data["event"] not in ("acquire", "release"):
                print(f"Error: Line {line_num} has invalid event: {data['event']}")
                return False
            
            if not isinstance(data["unit"], int) or not (0 <= data["unit"] <= 11):
                print(f"Error: Line {line_num} has invalid unit: {data['unit']}")
                return False
            
            if not isinstance(data["ts"], (int, float)):
                print(f"Error: Line {line_num} has invalid ts: {data['ts']}")
                return False
            
            events.append(data)
            
    # Check that each unit has exactly one acquire and one release, in order
    unit_states = {} # unit_id -> list of events
    for event in events:
        unit = event["unit"]
        unit_states.setdefault(unit, []).append(event)
        
    for unit in range(12):
        if unit not in unit_states:
            print(f"Error: Unit {unit} has no events in the log.")
            return False
        
        u_events = unit_states[unit]
        if len(u_events) != 2:
            print(f"Error: Unit {unit} has {len(u_events)} events (expected 2).")
            return False
        
        if u_events[0]["event"] != "acquire" or u_events[1]["event"] != "release":
            print(f"Error: Unit {unit} events are not in order [acquire, release]. Found: {[e['event'] for e in u_events]}")
            return False
        
        if u_events[0]["ts"] > u_events[1]["ts"]:
            print(f"Error: Unit {unit} acquire timestamp is greater than release timestamp.")
            return False
            
    # Check concurrent occupancy
    # We sort all event points by ts. If ts are identical, releases should be processed before acquires to be conservative?
    # Actually, let's just sort by ts.
    sorted_events = sorted(events, key=lambda x: x["ts"])
    
    current_occupancy = 0
    max_occupancy = 0
    active_units = set()
    
    for event in sorted_events:
        unit = event["unit"]
        if event["event"] == "acquire":
            current_occupancy += 1
            active_units.add(unit)
        else:
            current_occupancy -= 1
            active_units.remove(unit)
            
        if current_occupancy > max_occupancy:
            max_occupancy = current_occupancy
            
        print(f"ts: {event['ts']:.4f} | Event: {event['event']:<7} | Unit: {unit:2d} | Occupancy: {current_occupancy} | Active: {sorted(list(active_units))}")
        
    print(f"\nVerification successful!")
    print(f"Total events: {len(events)}")
    print(f"Max occupancy reached: {max_occupancy}")
    return True

if __name__ == "__main__":
    verify_log()
