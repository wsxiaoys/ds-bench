import sys
import time
import requests
import base64
import lancedb

# Make sure we can import from the project directory
sys.path.insert(0, "/home/user/myproject")

from solution import IndexerCoordinator
import seed_dataset

def test_leader_election():
    print("--- Testing Leader Election ---")
    c1 = IndexerCoordinator(worker_id="worker_1", ttl=3)
    c2 = IndexerCoordinator(worker_id="worker_2", ttl=3)
    
    # Ensure no previous leader key remains
    requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": base64.b64encode(b"/lancedb/indexer/leader").decode('utf-8')})
    
    assert c1.acquire() is True, "c1 should acquire leadership"
    assert c1.is_leader() is True, "c1 should be leader"
    assert c2.acquire() is False, "c2 should fail to acquire leadership"
    assert c2.is_leader() is False, "c2 should not be leader"
    
    token1 = c1.fencing_token()
    assert isinstance(token1, int), "Fencing token must be an integer"
    assert c2.fencing_token() is None, "c2 fencing token must be None"
    print(f"c1 acquired leadership with token {token1}")
    
    # Graceful resign
    c1.resign()
    assert c1.is_leader() is False, "c1 should not be leader after resign"
    assert c1.fencing_token() is None, "c1 token should be None after resign"
    
    # c2 should be able to acquire now
    assert c2.acquire() is True, "c2 should now acquire leadership"
    token2 = c2.fencing_token()
    assert isinstance(token2, int), "c2 fencing token must be an integer"
    assert token2 > token1, f"c2 token ({token2}) must be strictly greater than c1 token ({token1})"
    print(f"c2 acquired leadership with token {token2}")
    
    c2.close()
    c1.close()
    print("Leader Election Tests Passed!")

def test_crash_and_failover():
    print("\n--- Testing Crash and Failover ---")
    c1 = IndexerCoordinator(worker_id="worker_1", ttl=2)
    c2 = IndexerCoordinator(worker_id="worker_2", ttl=2)
    
    requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": base64.b64encode(b"/lancedb/indexer/leader").decode('utf-8')})
    
    assert c1.acquire() is True
    token1 = c1.fencing_token()
    print(f"c1 is leader with token {token1}")
    
    # Simulate crash
    c1.simulate_crash()
    assert c1.is_leader() is False, "c1 should immediately report not leader locally"
    
    # c2 tries to acquire immediately - should fail because TTL has not elapsed on etcd side
    assert c2.acquire() is False, "c2 should not acquire leadership immediately after crash (TTL has not elapsed)"
    print("c2 failed to acquire immediately as expected.")
    
    # Wait for TTL to elapse (2 seconds, let's wait 2.5)
    print("Waiting for lease to expire...")
    time.sleep(2.5)
    
    assert c2.acquire() is True, "c2 should acquire leadership after TTL elapsed"
    token2 = c2.fencing_token()
    assert token2 > token1, f"c2 token ({token2}) must be strictly greater than c1 token ({token1})"
    print(f"c2 successfully acquired leadership after timeout with token {token2}")
    
    c2.close()
    c1.close()
    print("Crash and Failover Tests Passed!")

def test_maintenance_and_fencing():
    print("\n--- Testing Maintenance and Fencing ---")
    
    # Reset dataset
    print("Resetting dataset...")
    seed_dataset.reset()
    
    c1 = IndexerCoordinator(worker_id="worker_1", ttl=3)
    c2 = IndexerCoordinator(worker_id="worker_2", ttl=3)
    
    requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": base64.b64encode(b"/lancedb/indexer/leader").decode('utf-8')})
    
    # c1 tries to run maintenance without holding leadership
    try:
        c1.run_maintenance()
        assert False, "c1 run_maintenance should raise PermissionError"
    except PermissionError as e:
        print("c1 run_maintenance raised PermissionError as expected:", e)
        
    # c1 acquires leadership
    assert c1.acquire() is True
    token1 = c1.fencing_token()
    
    # Run maintenance as leader
    res = c1.run_maintenance()
    print("Maintenance result:", res)
    assert res["worker_id"] == "worker_1"
    assert res["fencing_token"] == token1
    assert res["unindexed_before"] == 200
    assert res["unindexed_after"] == 0
    assert res["version_after"] > res["version_before"]
    
    # Now simulate a stale leader by manually deleting the key in etcd (representing a lost lease)
    requests.post("http://127.0.0.1:2379/v3/kv/deleterange", json={"key": base64.b64encode(b"/lancedb/indexer/leader").decode('utf-8')})
    
    # c1 tries to run maintenance again - should fail because etcd check fails
    try:
        c1.run_maintenance()
        assert False, "c1 run_maintenance should raise PermissionError after lease key was deleted"
    except PermissionError as e:
        print("c1 run_maintenance raised PermissionError after key deletion as expected:", e)
        
    c1.close()
    c2.close()
    print("Maintenance and Fencing Tests Passed!")

if __name__ == "__main__":
    test_leader_election()
    test_crash_and_failover()
    test_maintenance_and_fencing()
    print("\nAll tests passed successfully!")
