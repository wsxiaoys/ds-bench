import time
import base64
import requests
import seed_dataset
from solution import IndexerCoordinator

def test_leader_election():
    print("--- Running test_leader_election ---")
    # Clean up any existing leader key first
    key_b64 = base64.b64encode(b"/lancedb/indexer/leader").decode()
    requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": key_b64})

    w1 = IndexerCoordinator("worker-1", ttl=3)
    w2 = IndexerCoordinator("worker-2", ttl=3)

    try:
        # 1. Acquire
        assert w1.acquire() is True, "w1 should acquire leadership"
        assert w2.acquire() is False, "w2 should fail to acquire leadership"

        assert w1.is_leader() is True, "w1 is leader"
        assert w2.is_leader() is False, "w2 is not leader"

        token1 = w1.fencing_token()
        assert isinstance(token1, int), "token1 should be an integer"
        assert w2.fencing_token() is None, "token2 should be None"

        print(f"w1 acquired leadership with token {token1}")

        # 2. Graceful resign
        w1.resign()
        assert w1.is_leader() is False, "w1 should no longer be leader"
        assert w1.fencing_token() is None, "token1 should be None after resign"

        assert w2.acquire() is True, "w2 should now acquire leadership"
        token2 = w2.fencing_token()
        assert isinstance(token2, int), "token2 should be an integer"
        assert token2 > token1, f"token2 ({token2}) must be strictly greater than token1 ({token1})"

        print(f"w2 acquired leadership with token {token2}")

        # 3. Simulate crash (ungraceful failover)
        w2.simulate_crash()
        assert w2.is_leader() is False, "w2 is no longer leader after crash"

        # w1 tries to acquire immediately - should fail because TTL is 3s and key still exists
        assert w1.acquire() is False, "w1 should fail to acquire immediately after w2 crash"

        print("Waiting for lease TTL to expire...")
        time.sleep(4.0)

        assert w1.acquire() is True, "w1 should acquire leadership after TTL expires"
        token3 = w1.fencing_token()
        assert token3 > token2, f"token3 ({token3}) must be strictly greater than token2 ({token2})"
        print(f"w1 acquired leadership again with token {token3}")

        w1.resign()
    finally:
        w1.close()
        w2.close()
    print("test_leader_election passed!")

def test_maintenance():
    print("--- Running test_maintenance ---")
    # Reset seed dataset
    seed_dataset.reset()

    # Clean up key
    key_b64 = base64.b64encode(b"/lancedb/indexer/leader").decode()
    requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": key_b64})

    w1 = IndexerCoordinator("worker-1", ttl=3)
    w2 = IndexerCoordinator("worker-2", ttl=3)

    try:
        assert w1.acquire() is True

        # Non-leader running maintenance should raise PermissionError
        try:
            w2.run_maintenance()
            assert False, "w2 should have raised PermissionError"
        except PermissionError:
            pass
        except Exception as e:
            assert False, f"w2 raised unexpected exception: {e}"

        # Leader running maintenance
        res = w1.run_maintenance()
        print("Maintenance result:", res)
        assert res["worker_id"] == "worker-1"
        assert res["fencing_token"] == w1.fencing_token()
        assert res["unindexed_before"] == 200
        assert res["unindexed_after"] == 0
        assert res["version_after"] > res["version_before"]

        w1.resign()
    finally:
        w1.close()
        w2.close()
    print("test_maintenance passed!")

def test_fencing():
    print("--- Running test_fencing ---")
    # Reset seed dataset
    seed_dataset.reset()

    key_b64 = base64.b64encode(b"/lancedb/indexer/leader").decode()
    requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": key_b64})

    w1 = IndexerCoordinator("worker-1", ttl=3)

    try:
        assert w1.acquire() is True
        
        # Manually delete key from etcd to simulate fencing condition
        requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": key_b64})

        try:
            w1.run_maintenance()
            assert False, "w1 should have raised PermissionError due to fencing"
        except PermissionError:
            print("Fencing test successfully caught PermissionError!")
        except Exception as e:
            assert False, f"w1 raised unexpected exception: {e}"

        assert w1.is_leader() is False, "w1 should have set is_leader to False after fencing failure"
    finally:
        w1.close()
    print("test_fencing passed!")

if __name__ == "__main__":
    test_leader_election()
    test_maintenance()
    test_fencing()
    print("All tests passed successfully!")
