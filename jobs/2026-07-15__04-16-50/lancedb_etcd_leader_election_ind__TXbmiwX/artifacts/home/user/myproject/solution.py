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
        self._etcd_url = etcd_url
        
        # Base64 encoded key and value for etcd gateway
        self._key_b64 = base64.b64encode(election_key.encode('utf-8')).decode('utf-8')
        self._val_b64 = base64.b64encode(worker_id.encode('utf-8')).decode('utf-8')
        
        self._lease_id = None
        self._fencing_token = None
        self._is_leader = False
        self._last_keepalive = 0.0
        
        self._keepalive_thread = None
        self._stop_keepalive = threading.Event()
        self._lock = threading.Lock()

    def acquire(self) -> bool:
        """
        Non-blocking attempt to become leader.
        Returns True only if this instance won leadership, False otherwise.
        On failure it must not leak a lease.
        """
        with self._lock:
            if self._is_leader:
                # Already leader, verify we still hold the lease
                if time.time() - self._last_keepalive < self._ttl:
                    return True
                else:
                    # We lost it due to timeout
                    self._is_leader = False
                    self._lease_id = None
                    self._fencing_token = None

            # 1. Grant a lease with bounded TTL
            url_grant = f"{self._etcd_url}/v3/lease/grant"
            try:
                resp = requests.post(url_grant, json={"TTL": self._ttl}, timeout=2.0)
                resp.raise_for_status()
                data = resp.json()
                lease_id = data.get("ID")
                if not lease_id:
                    return False
            except Exception:
                return False
            
            # 2. Attempt compare-and-create transaction on election_key bound to that lease
            url_txn = f"{self._etcd_url}/v3/kv/txn"
            txn_payload = {
                "compare": [
                    {
                        "result": "EQUAL",
                        "target": "CREATE",
                        "key": self._key_b64,
                        "create_revision": "0"
                    }
                ],
                "success": [
                    {
                        "request_put": {
                            "key": self._key_b64,
                            "value": self._val_b64,
                            "lease": lease_id
                        }
                    }
                ]
            }
            try:
                resp = requests.post(url_txn, json=txn_payload, timeout=2.0)
                resp.raise_for_status()
                txn_data = resp.json()
            except Exception:
                self._revoke_lease_silent(lease_id)
                return False
            
            succeeded = txn_data.get("succeeded", False)
            if not succeeded:
                self._revoke_lease_silent(lease_id)
                return False
            
            # 3. We won! Retrieve the create_revision of the election key to use as fencing token
            url_range = f"{self._etcd_url}/v3/kv/range"
            try:
                resp = requests.post(url_range, json={"key": self._key_b64}, timeout=2.0)
                resp.raise_for_status()
                range_data = resp.json()
                kvs = range_data.get("kvs", [])
                if not kvs:
                    self._revoke_lease_silent(lease_id)
                    return False
                
                kv = kvs[0]
                create_rev = int(kv.get("create_revision", "0"))
                val_bytes = base64.b64decode(kv.get("value", ""))
                val_str = val_bytes.decode('utf-8')
                
                if val_str != self._worker_id or str(kv.get("lease")) != str(lease_id):
                    self._revoke_lease_silent(lease_id)
                    return False
                
            except Exception:
                self._revoke_lease_silent(lease_id)
                return False
            
            # Set leader state
            self._lease_id = lease_id
            self._fencing_token = create_rev
            self._is_leader = True
            self._last_keepalive = time.time()
            self._stop_keepalive.clear()
            
            # Start background keepalive thread
            self._keepalive_thread = threading.Thread(
                target=self._keepalive_loop,
                args=(lease_id,),
                daemon=True
            )
            self._keepalive_thread.start()
            return True

    def is_leader(self) -> bool:
        """
        True only while this instance currently holds leadership.
        """
        with self._lock:
            if self._is_leader and self._lease_id is not None:
                if time.time() - self._last_keepalive >= self._ttl:
                    self._is_leader = False
                    self._lease_id = None
                    self._fencing_token = None
            return self._is_leader

    def fencing_token(self) -> int | None:
        """
        The integer token for this instance's current leadership term,
        or None if it does not currently hold leadership.
        """
        with self._lock:
            if self._is_leader and self._lease_id is not None:
                if time.time() - self._last_keepalive >= self._ttl:
                    self._is_leader = False
                    self._lease_id = None
                    self._fencing_token = None
            return self._fencing_token

    def run_maintenance(self) -> dict:
        """
        If this instance is not the current leader, raise PermissionError;
        otherwise run maintenance on the shared table and return a dict with
        exactly the keys worker_id, fencing_token, version_before, version_after,
        unindexed_before, unindexed_after.
        """
        # 1. Live fence check against etcd
        token = self._check_leadership_live()
        
        # 2. Connect to LanceDB and run maintenance
        try:
            db = lancedb.connect(self._db_uri)
            table = db.open_table(self._table_name)
            
            indices = table.list_indices()
            index_name = indices[0].name if indices else "vector_idx"
            
            # Retrieve stats before
            stats_before = table.index_stats(index_name)
            unindexed_before = stats_before.num_unindexed_rows if stats_before else 0
            
            versions = table.list_versions()
            version_before = max(v['version'] for v in versions) if versions else 0
            
            # Run compaction and update vector index
            table.optimize()
            
            # Retrieve stats after
            stats_after = table.index_stats(index_name)
            unindexed_after = stats_after.num_unindexed_rows if stats_after else 0
            
            versions_after = table.list_versions()
            version_after = max(v['version'] for v in versions_after) if versions_after else 0
            
        except Exception as e:
            raise RuntimeError(f"LanceDB maintenance failed: {e}")
        
        return {
            "worker_id": self._worker_id,
            "fencing_token": int(token),
            "version_before": int(version_before),
            "version_after": int(version_after),
            "unindexed_before": int(unindexed_before),
            "unindexed_after": int(unindexed_after),
        }

    def resign(self) -> None:
        """
        Graceful step-down (revoke lease and delete the election key)
        so a follower can win immediately.
        """
        self._stop_keepalive.set()
        if self._keepalive_thread and self._keepalive_thread.is_alive():
            try:
                self._keepalive_thread.join(timeout=1.0)
            except Exception:
                pass
        
        with self._lock:
            if self._lease_id is not None:
                # Delete the election key from etcd
                url_delete = f"{self._etcd_url}/v3/kv/deleterange"
                try:
                    requests.post(url_delete, json={"key": self._key_b64}, timeout=2.0)
                except Exception:
                    pass
                
                # Revoke the lease
                self._revoke_lease_silent(self._lease_id)
                
            self._is_leader = False
            self._lease_id = None
            self._fencing_token = None

    def simulate_crash(self) -> None:
        """
        Stop refreshing the lease WITHOUT revoking it (models a crashed/partitioned leader);
        leadership must become available only after the TTL elapses.
        """
        with self._lock:
            self._stop_keepalive.set()
            self._is_leader = False
            self._lease_id = None
            self._fencing_token = None

    def close(self) -> None:
        """
        Release local resources/threads.
        """
        self.resign()

    def _keepalive_loop(self, lease_id):
        interval = max(0.5, min(1.0, self._ttl / 3.0))
        url_keepalive = f"{self._etcd_url}/v3/lease/keepalive"
        
        while not self._stop_keepalive.is_set():
            if self._stop_keepalive.wait(timeout=interval):
                break
            
            try:
                resp = requests.post(url_keepalive, json={"ID": lease_id}, timeout=1.0)
                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get("result", {})
                    ttl_str = result.get("TTL")
                    if ttl_str and int(ttl_str) > 0:
                        self._last_keepalive = time.time()
                    else:
                        # Lease expired or not found
                        self._handle_lost_leadership()
                        break
                else:
                    # Non-200 response
                    pass
            except Exception:
                # Network error/timeout
                pass
            
            # Check if too much time has elapsed since last successful keepalive
            if time.time() - self._last_keepalive >= self._ttl:
                self._handle_lost_leadership()
                break

    def _handle_lost_leadership(self):
        with self._lock:
            if self._is_leader:
                self._is_leader = False
                self._lease_id = None
                self._fencing_token = None

    def _revoke_lease_silent(self, lease_id):
        url_revoke = f"{self._etcd_url}/v3/lease/revoke"
        try:
            requests.post(url_revoke, json={"ID": lease_id}, timeout=2.0)
        except Exception:
            pass

    def _check_leadership_live(self) -> int:
        """
        Check against etcd that we still own the election key with our current fencing token.
        Returns the create_revision (token) if we do, else raises PermissionError.
        """
        with self._lock:
            # First check local leadership state and TTL timeout
            if not self._is_leader or self._fencing_token is None or self._lease_id is None:
                raise PermissionError("Not the current leader (local state)")
            
            if time.time() - self._last_keepalive >= self._ttl:
                self._is_leader = False
                self._lease_id = None
                self._fencing_token = None
                raise PermissionError("Not the current leader (lease expired locally)")
            
            fencing_token = self._fencing_token
            lease_id = self._lease_id

        # Live check against etcd (outside lock to avoid blocking other methods during network call)
        url = f"{self._etcd_url}/v3/kv/range"
        try:
            resp = requests.post(url, json={"key": self._key_b64}, timeout=2.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            raise PermissionError(f"Failed to verify leadership with etcd: {e}")
        
        kvs = data.get("kvs", [])
        if not kvs:
            raise PermissionError("Election key does not exist in etcd")
        
        kv = kvs[0]
        try:
            val_bytes = base64.b64decode(kv.get("value", ""))
            val_str = val_bytes.decode('utf-8')
        except Exception:
            raise PermissionError("Failed to decode election key value from etcd")
        
        try:
            create_rev = int(kv.get("create_revision", "0"))
        except Exception:
            raise PermissionError("Failed to parse create_revision from etcd")
        
        lease_id_etcd = kv.get("lease")
        
        if create_rev != fencing_token:
            raise PermissionError(f"Fencing token mismatch: etcd={create_rev}, local={fencing_token}")
        if val_str != self._worker_id:
            raise PermissionError(f"Worker ID mismatch: etcd={val_str}, local={self._worker_id}")
        if str(lease_id_etcd) != str(lease_id):
            raise PermissionError(f"Lease ID mismatch: etcd={lease_id_etcd}, local={lease_id}")
            
        return create_rev
