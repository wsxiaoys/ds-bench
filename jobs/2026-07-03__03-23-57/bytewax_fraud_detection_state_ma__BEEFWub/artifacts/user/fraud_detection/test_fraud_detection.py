#!/usr/bin/env python3
import json
import os
import subprocess

def run_test(name, inputs, expected_alerts):
    print(f"Running test: {name}")
    input_file = f"test_{name}_input.jsonl"
    output_file = f"test_{name}_output.jsonl"

    # Write input file
    with open(input_file, "w") as f:
        for item in inputs:
            f.write(json.dumps(item) + "\n")

    # Run run.py
    try:
        subprocess.run(
            ["python3", "run.py", "--input", input_file, "--output", output_file],
            check=True,
            capture_output=True,
            text=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error running run.py for {name}:")
        print("stdout:", e.stdout)
        print("stderr:", e.stderr)
        raise e

    # Read output file
    alerts = []
    if os.path.exists(output_file):
        with open(output_file, "r") as f:
            for line in f:
                if line.strip():
                    alerts.append(json.loads(line.strip()))

    # Compare with expected alerts
    assert len(alerts) == len(expected_alerts), f"Expected {len(expected_alerts)} alerts, got {len(alerts)}: {alerts}"
    for alert, expected in zip(alerts, expected_alerts):
        assert alert == expected, f"Expected alert {expected}, got {alert}"

    # Clean up files
    if os.path.exists(input_file):
        os.remove(input_file)
    if os.path.exists(output_file):
        os.remove(output_file)

    print(f"Test {name} PASSED!\n")


def main():
    # Test 1: Normal flow (3 large transactions within 300s)
    run_test(
        "normal_flow",
        [
            {"user_id": "user1", "event_type": "login", "timestamp": 1000},
            {"user_id": "user1", "event_type": "transaction", "amount": 1000, "timestamp": 1100},
            {"user_id": "user1", "event_type": "transaction", "amount": 1500, "timestamp": 1200},
            {"user_id": "user1", "event_type": "transaction", "amount": 2000, "timestamp": 1300},
        ],
        [
            {"user_id": "user1", "alert": "FRAUD_ALERT"}
        ]
    )

    # Test 2: Reset on > 300s
    run_test(
        "reset_on_timeout",
        [
            {"user_id": "user1", "event_type": "login", "timestamp": 1000},
            {"user_id": "user1", "event_type": "transaction", "amount": 1000, "timestamp": 1100},
            {"user_id": "user1", "event_type": "transaction", "amount": 1500, "timestamp": 1200},
            {"user_id": "user1", "event_type": "transaction", "amount": 2000, "timestamp": 1301}, # 1301 - 1000 = 301 > 300
        ],
        []
    )

    # Test 3: Logout flow
    run_test(
        "logout_flow",
        [
            {"user_id": "user1", "event_type": "login", "timestamp": 1000},
            {"user_id": "user1", "event_type": "transaction", "amount": 1000, "timestamp": 1100},
            {"user_id": "user1", "event_type": "logout", "timestamp": 1150},
            {"user_id": "user1", "event_type": "login", "timestamp": 1200},
            {"user_id": "user1", "event_type": "transaction", "amount": 1500, "timestamp": 1250},
            {"user_id": "user1", "event_type": "transaction", "amount": 2000, "timestamp": 1300},
        ],
        []
    )

    # Test 4: Transaction when logged out
    run_test(
        "logged_out_transaction",
        [
            {"user_id": "user1", "event_type": "transaction", "amount": 1000, "timestamp": 900},
            {"user_id": "user1", "event_type": "login", "timestamp": 1000},
            {"user_id": "user1", "event_type": "transaction", "amount": 1500, "timestamp": 1100},
            {"user_id": "user1", "event_type": "transaction", "amount": 2000, "timestamp": 1200},
        ],
        []
    )

    # Test 5: Less than 1000 transaction
    run_test(
        "small_transaction",
        [
            {"user_id": "user1", "event_type": "login", "timestamp": 1000},
            {"user_id": "user1", "event_type": "transaction", "amount": 1000, "timestamp": 1100},
            {"user_id": "user1", "event_type": "transaction", "amount": 500, "timestamp": 1150}, # small
            {"user_id": "user1", "event_type": "transaction", "amount": 1500, "timestamp": 1200},
            {"user_id": "user1", "event_type": "transaction", "amount": 2000, "timestamp": 1250},
        ],
        [
            {"user_id": "user1", "alert": "FRAUD_ALERT"}
        ]
    )

    # Test 6: Multiple users
    run_test(
        "multiple_users",
        [
            {"user_id": "user1", "event_type": "login", "timestamp": 1000},
            {"user_id": "user2", "event_type": "login", "timestamp": 1010},
            {"user_id": "user1", "event_type": "transaction", "amount": 1000, "timestamp": 1100},
            {"user_id": "user2", "event_type": "transaction", "amount": 2000, "timestamp": 1110},
            {"user_id": "user1", "event_type": "transaction", "amount": 1200, "timestamp": 1150},
            {"user_id": "user1", "event_type": "transaction", "amount": 1300, "timestamp": 1200}, # user1 alerts
            {"user_id": "user2", "event_type": "transaction", "amount": 2100, "timestamp": 1210},
            {"user_id": "user2", "event_type": "transaction", "amount": 2200, "timestamp": 1220}, # user2 alerts
        ],
        [
            {"user_id": "user1", "alert": "FRAUD_ALERT"},
            {"user_id": "user2", "alert": "FRAUD_ALERT"}
        ]
    )

    print("All tests PASSED successfully!")


if __name__ == "__main__":
    main()
