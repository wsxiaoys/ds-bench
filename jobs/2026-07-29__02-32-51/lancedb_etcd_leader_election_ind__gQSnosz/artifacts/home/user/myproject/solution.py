import base64
import threading
import time
import requests
import lancedb

class IndexerCoordinator:
    def __init__(
        self,
        worker_id: str,
        *,
        election_key: str = "/lancedb/indexer/leader",
        ttl: int = 3,
        db_uri: str = "/home/user/myproject/lancedb",
        table_name: str = "documents",
        etcd_url: str = "http://127.0.0.1:2379"
    ):
        self._worker_id = worker_id
        self._election_key = election_key
        self._ttl = ttl
        self._db_uri = db_uri
        self._table_name = table_name
        self._etcd_url = etcd_url.rstrip("/")
        
        self._lock = threading.Lock()
        self._is_leader = False
        self._lease_id = None
        self._fencing_token = None
        self._crashed = False
        self._closed = False
        self._thread = None

    def acquire(self) -> bool:
        with self._lock:
            if self._closed:
                return False
            if self._is_leader and not self._crashed:
                return True
            
            # Reset state
            self._is_leader = False
            self._lease_id = None
            self._fencing_token = None
            self._crashed = False

        # 1. Grant lease
        try:
            r = requests.post(
                f"{self._etcd_url}/v3/lease/grant",
                json={"TTL": self._ttl},
                timeout=2.0
            )
            if r.status_code != 200:
                return False
            lease_id = r.json().get("ID")
            if not lease_id:
                return False
        except Exception:
            return False

        # 2. Txn compare-and-create
        key_b64 = base64.b64encode(self._election_key.encode("utf-8")).decode("utf-8")
        val_b64 = base64.b64encode(self._worker_id.encode("utf-8")).decode("utf-8")

        txn_req = {
            "compare": [{
                "result": "EQUAL",
                "target": "CREATE",
                "key": key_b64,
                "create_revision": "0"
            }],
            "success": [
                {
                    "request_put": {
                        "key": key_b64,
                        "value": val_b64,
                        "lease": str(lease_id)
                    }
                },
                {
                    "request_range": {
                        "key": key_b64
                    }
                }
            ],
            "failure": [{
                "request_range": {
                    "key": key_b64
                }
            }]
        }

        try:
            r_txn = requests.post(
                f"{self._etcd_url}/v3/kv/txn",
                json=txn_req,
                timeout=2.0
            )
            if r_txn.status_code != 200:
                self._revoke_lease_silent(lease_id)
                return False
            
            data = r_txn.json()
            if data.get("succeeded", False):
                # We won!
                responses = data.get("responses", [])
                if len(responses) >= 2:
                    kvs = responses[1].get("response_range", {}).get("kvs", [])
                    if kvs:
                        fencing_token = int(kvs[0].get("create_revision", 0))
                    else:
                        fencing_token = int(responses[0].get("response_put", {}).get("header", {}).get("revision", 0))
                else:
                    fencing_token = int(responses[0].get("response_put", {}).get("header", {}).get("revision", 0))
                
                with self._lock:
                    if self._closed:
                        self._revoke_lease_silent(lease_id)
                        return False
                    self._lease_id = lease_id
                    self._fencing_token = fencing_token
                    self._is_leader = True
                    self._crashed = False
                    
                    # Start background thread
                    self._thread = threading.Thread(target=self._keep_alive_loop, daemon=True)
                    self._thread.start()
                return True
            else:
                self._revoke_lease_silent(lease_id)
                return False
        except Exception:
            self._revoke_lease_silent(lease_id)
            return False

    def is_leader(self) -> bool:
        with self._lock:
            return self._is_leader and not self._crashed and not self._closed

    def fencing_token(self) -> int | None:
        with self._lock:
            if self._is_leader and not self._crashed and not self._closed:
                return self._fencing_token
            return None

    def run_maintenance(self) -> dict:
        if not self.is_leader():
            raise PermissionError("Not the current leader")
            
        if not self._check_leadership_token():
            with self._lock:
                self._is_leader = False
            raise PermissionError("Leadership verification failed (fenced)")
            
        try:
            db = lancedb.connect(self._db_uri)
            tbl = db.open_table(self._table_name)
        except Exception as e:
            raise RuntimeError(f"Failed to connect to LanceDB table: {e}")
            
        try:
            versions = tbl.list_versions()
            if not versions:
                raise RuntimeError("No versions found for the table")
            version_before = int(versions[-1]["version"])
            
            indices = tbl.list_indices()
            index_name = indices[0].name if indices else "vector_idx"
            stats_before = tbl.index_stats(index_name)
            unindexed_before = int(getattr(stats_before, "num_unindexed_rows", 0) if stats_before else 0)
        except Exception as e:
            raise RuntimeError(f"Failed to read table stats: {e}")
            
        try:
            tbl.optimize()
        except Exception as e:
            raise RuntimeError(f"Failed to run optimize: {e}")
            
        try:
            versions_after = tbl.list_versions()
            version_after = int(versions_after[-1]["version"])
            stats_after = tbl.index_stats(index_name)
            unindexed_after = int(getattr(stats_after, "num_unindexed_rows", 0) if stats_after else 0)
        except Exception as e:
            raise RuntimeError(f"Failed to read table stats after optimize: {e}")
            
        return {
            "worker_id": str(self._worker_id),
            "fencing_token": int(self._fencing_token),
            "version_before": version_before,
            "version_after": version_after,
            "unindexed_before": unindexed_before,
            "unindexed_after": unindexed_after
        }

    def resign(self) -> None:
        with self._lock:
            if not self._is_leader:
                return
            self._is_leader = False
            lease_id = self._lease_id
            self._lease_id = None
            self._fencing_token = None
            self._crashed = False
            
        if lease_id:
            try:
                requests.post(
                    f"{self._etcd_url}/v3/lease/revoke",
                    json={"ID": str(lease_id)},
                    timeout=2.0
                )
            except Exception:
                pass
            
            try:
                key_b64 = base64.b64encode(self._election_key.encode("utf-8")).decode("utf-8")
                requests.post(
                    f"{self._etcd_url}/v3/kv/deleterange",
                    json={"key": key_b64},
                    timeout=2.0
                )
            except Exception:
                pass

    def simulate_crash(self) -> None:
        with self._lock:
            self._crashed = True
            self._is_leader = False

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
        self.resign()

    def _revoke_lease_silent(self, lease_id):
        if not lease_id:
            return
        try:
            requests.post(
                f"{self._etcd_url}/v3/lease/revoke",
                json={"ID": str(lease_id)},
                timeout=2.0
            )
        except Exception:
            pass

    def _check_leadership_token(self) -> bool:
        with self._lock:
            if not self._lease_id or self._fencing_token is None:
                return False
            lease_id = self._lease_id
            fencing_token = self._fencing_token
            
        try:
            key_b64 = base64.b64encode(self._election_key.encode("utf-8")).decode("utf-8")
            r = requests.post(f"{self._etcd_url}/v3/kv/range", json={"key": key_b64}, timeout=2.0)
            if r.status_code != 200:
                return False
            data = r.json()
            kvs = data.get("kvs", [])
            if not kvs:
                return False
            kv = kvs[0]
            create_rev = int(kv.get("create_revision", 0))
            if create_rev != fencing_token:
                return False
            lease = kv.get("lease")
            if lease != str(lease_id):
                return False
            return True
        except Exception:
            return False

    def _keep_alive_loop(self):
        with self._lock:
            lease_id = self._lease_id
            ttl = self._ttl
            etcd_url = self._etcd_url
        
        last_success = time.time()
        while True:
            with self._lock:
                if not self._is_leader or self._crashed or self._closed:
                    break
            
            if time.time() - last_success > ttl:
                with self._lock:
                    self._is_leader = False
                break
                
            try:
                r = requests.post(
                    f"{etcd_url}/v3/lease/keepalive",
                    json={"ID": str(lease_id)},
                    timeout=max(1.0, ttl / 2.0)
                )
                if r.status_code == 200:
                    data = r.json()
                    result = data.get("result", {})
                    if "TTL" in result:
                        last_success = time.time()
                    else:
                        with self._lock:
                            self._is_leader = False
                        break
            except Exception:
                pass
                
            # Sleep in small steps to respond to stop signals quickly
            sleep_time = max(0.2, ttl / 3.0)
            start_sleep = time.time()
            while time.time() - start_sleep < sleep_time:
                with self._lock:
                    if not self._is_leader or self._crashed or self._closed:
                        break
                time.sleep(0.1)
