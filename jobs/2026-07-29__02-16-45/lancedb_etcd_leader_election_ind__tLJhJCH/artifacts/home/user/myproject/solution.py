"""Distributed LanceDB indexer coordinator using etcd v3 for leader election.

Leadership is implemented with the classic etcd recipe:

  1. Grant a lease with a bounded TTL.
  2. Attempt an atomic "create-if-absent" transaction on a single election
     key, binding the key to the lease. Only one candidate can win this
     transaction (etcd guarantees linearizable, atomic compare-and-swap via
     ``txn``).
  3. The etcd *revision* at which the winning ``Put`` was committed is used
     as the fencing token for the term. Because a freshly created key's
     ``create_revision`` always equals the revision of the transaction that
     created it, and because revisions are a single global, strictly
     increasing counter for the whole etcd keyspace, this token is
     guaranteed to be strictly greater than the token of every previous
     term (by any worker).
  4. While leader, a background thread refreshes ("keeps alive") the lease.
     On graceful resignation the lease is revoked and the key removed
     immediately, letting a follower win right away. On a simulated crash
     the keepalive thread is simply stopped; etcd removes the (now stale)
     lease and its attached key once the TTL elapses, and only then can a
     follower win a new term.
  5. Before doing any real (expensive) maintenance work, the leader
     re-confirms -- directly against etcd -- that it still owns the
     election key under its own fencing token. This is the fencing check
     that prevents a leader that has already lost the election (e.g. its
     lease expired while it was partitioned) from mutating the shared
     LanceDB table.

The etcd JSON gRPC-gateway is used over plain HTTP so the only external
dependency is ``requests``.
"""

from __future__ import annotations

import base64
import threading
from typing import Any, Optional

import requests


class IndexerCoordinator:
    """Coordinates LanceDB maintenance across a fleet of workers via etcd."""

    def __init__(
        self,
        worker_id: str,
        *,
        election_key: str = "/lancedb/indexer/leader",
        ttl: int = 3,
        db_uri: str = "/home/user/myproject/lancedb",
        table_name: str = "documents",
        etcd_url: str = "http://127.0.0.1:2379",
    ) -> None:
        self.worker_id = worker_id
        self.election_key = election_key
        self.ttl = int(ttl)
        self.db_uri = db_uri
        self.table_name = table_name
        self.etcd_url = etcd_url.rstrip("/")

        self._session = requests.Session()
        self._lock = threading.RLock()

        self._is_leader = False
        self._fencing_token_value: Optional[int] = None
        self._lease_id: Optional[str] = None

        self._keepalive_thread: Optional[threading.Thread] = None
        self._stop_keepalive = threading.Event()

        self._closed = False

    # ------------------------------------------------------------------
    # etcd JSON gateway helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _b64(value: Any) -> str:
        if isinstance(value, str):
            value = value.encode("utf-8")
        return base64.b64encode(value).decode("ascii")

    @staticmethod
    def _unb64(value: Optional[str]) -> bytes:
        if not value:
            return b""
        return base64.b64decode(value)

    def _post(self, path: str, payload: dict, timeout: float = 5.0) -> dict:
        resp = self._session.post(
            f"{self.etcd_url}{path}", json=payload, timeout=timeout
        )
        resp.raise_for_status()
        return resp.json()

    def _safe_revoke(self, lease_id: str) -> None:
        try:
            self._post("/v3/lease/revoke", {"ID": lease_id})
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Leader election
    # ------------------------------------------------------------------
    def acquire(self) -> bool:
        """Non-blocking attempt to become leader.

        Returns True only if *this* instance won leadership. Never leaves a
        lease granted if the election was lost.
        """
        with self._lock:
            if self._is_leader:
                return True

            lease_id = None
            try:
                grant = self._post("/v3/lease/grant", {"TTL": self.ttl})
                lease_id = grant["ID"]

                key_b64 = self._b64(self.election_key)
                val_b64 = self._b64(self.worker_id)
                txn = {
                    "compare": [
                        {
                            "target": "CREATE",
                            "create_revision": 0,
                            "key": key_b64,
                        }
                    ],
                    "success": [
                        {
                            "requestPut": {
                                "key": key_b64,
                                "value": val_b64,
                                "lease": lease_id,
                            }
                        }
                    ],
                    "failure": [{"requestRange": {"key": key_b64}}],
                }
                result = self._post("/v3/kv/txn", txn)

                if not result.get("succeeded"):
                    self._safe_revoke(lease_id)
                    return False

                # The key was just created (the CREATE compare only succeeds
                # when it did not previously exist), so its create_revision
                # equals the revision at which this transaction committed.
                revision = int(
                    result["responses"][0]["response_put"]["header"]["revision"]
                )
            except Exception:
                if lease_id is not None:
                    self._safe_revoke(lease_id)
                return False

            self._lease_id = lease_id
            self._fencing_token_value = revision
            self._is_leader = True

            self._stop_keepalive.clear()
            thread = threading.Thread(
                target=self._keepalive_loop, args=(lease_id,), daemon=True
            )
            self._keepalive_thread = thread
            thread.start()
            return True

    def _keepalive_loop(self, lease_id: str) -> None:
        interval = max(self.ttl / 3.0, 0.25)
        while not self._stop_keepalive.wait(interval):
            try:
                self._post("/v3/lease/keepalive", {"ID": lease_id})
            except Exception:
                # Transient network hiccup; try again next interval. If the
                # lease truly expires, the fencing check will catch it.
                continue

    def _check_leadership_locked(self) -> bool:
        """Must be called while holding self._lock.

        Re-verifies against etcd that we still own the election key under
        our own fencing token. This is the single source of truth for
        leadership -- it is what makes fencing correct even if the local
        keepalive thread has been stopped (graceful resign) or the process
        is pretending to have crashed (simulate_crash).
        """
        if (
            not self._is_leader
            or self._lease_id is None
            or self._fencing_token_value is None
        ):
            return False

        try:
            result = self._post("/v3/kv/range", {"key": self._b64(self.election_key)})
        except Exception:
            # Cannot confirm leadership right now. Fail safe: report NOT
            # leader rather than risk a stale leader running maintenance.
            return False

        kvs = result.get("kvs")
        if not kvs:
            self._forget_leadership_locked()
            return False

        kv = kvs[0]
        value = self._unb64(kv.get("value")).decode("utf-8", errors="replace")
        create_rev = int(kv.get("create_revision", -1))

        if value != self.worker_id or create_rev != self._fencing_token_value:
            self._forget_leadership_locked()
            return False

        return True

    def _forget_leadership_locked(self) -> None:
        self._stop_keepalive.set()
        self._is_leader = False
        self._fencing_token_value = None
        self._lease_id = None

    def is_leader(self) -> bool:
        with self._lock:
            return self._check_leadership_locked()

    def fencing_token(self) -> Optional[int]:
        with self._lock:
            if self._check_leadership_locked():
                return self._fencing_token_value
            return None

    # ------------------------------------------------------------------
    # Graceful / ungraceful loss of leadership
    # ------------------------------------------------------------------
    def resign(self) -> None:
        """Graceful step-down: revoke the lease and remove the election key
        so a follower can win immediately."""
        with self._lock:
            self._stop_keepalive.set()
            thread = self._keepalive_thread
            lease_id = self._lease_id
            self._keepalive_thread = None
            self._is_leader = False
            self._fencing_token_value = None
            self._lease_id = None

        if thread is not None and thread.is_alive():
            thread.join(timeout=self.ttl + 1)

        if lease_id is not None:
            try:
                self._post("/v3/kv/deleterange", {"key": self._b64(self.election_key)})
            except Exception:
                pass
            self._safe_revoke(lease_id)

    def simulate_crash(self) -> None:
        """Model a crashed/partitioned leader: stop refreshing the lease
        WITHOUT revoking it. The lease (and the election key bound to it)
        will only disappear once etcd expires it after `ttl` seconds."""
        with self._lock:
            self._stop_keepalive.set()
            thread = self._keepalive_thread
            self._keepalive_thread = None
            # Deliberately keep _is_leader / _fencing_token_value / _lease_id
            # as-is: whether we still "are" the leader is now determined by
            # etcd's TTL expiry, discovered lazily via _check_leadership_locked().
        if thread is not None and thread.is_alive():
            thread.join(timeout=1)

    def close(self) -> None:
        """Release local resources/threads (does not touch etcd state)."""
        with self._lock:
            self._stop_keepalive.set()
            thread = self._keepalive_thread
            self._keepalive_thread = None
        if thread is not None and thread.is_alive():
            thread.join(timeout=1)
        try:
            self._session.close()
        except Exception:
            pass
        self._closed = True

    # ------------------------------------------------------------------
    # LanceDB maintenance
    # ------------------------------------------------------------------
    @staticmethod
    def _resolve_index_name(tbl) -> Optional[str]:
        indices = tbl.list_indices()
        if indices:
            return indices[0].name
        return None

    @staticmethod
    def _unindexed_rows(tbl, idx_name: Optional[str]) -> int:
        if idx_name is None:
            return 0
        stats = tbl.index_stats(idx_name)
        if stats is None:
            return 0
        return int(stats.num_unindexed_rows)

    def run_maintenance(self) -> dict:
        """Run LanceDB maintenance (compaction + vector index rebuild).

        Only the current leader may call this. The check is fenced against
        etcd (not just the local flag) so a leader that has already lost
        the election cannot slip through.
        """
        with self._lock:
            if not self._check_leadership_locked():
                raise PermissionError(
                    f"worker {self.worker_id!r} is not the current leader"
                )
            token = self._fencing_token_value

        import lancedb  # local import keeps module import light for pure-election tests

        db = lancedb.connect(self.db_uri)
        tbl = db.open_table(self.table_name)

        idx_name = self._resolve_index_name(tbl)
        version_before = int(tbl.version)
        unindexed_before = self._unindexed_rows(tbl, idx_name)

        # Narrow the time-of-check-to-time-of-use window: re-confirm we are
        # still the fenced leader immediately before mutating shared state.
        with self._lock:
            if not self._check_leadership_locked() or self._fencing_token_value != token:
                raise PermissionError(
                    f"worker {self.worker_id!r} lost leadership before "
                    "running maintenance"
                )

        tbl.optimize()

        version_after = int(tbl.version)
        unindexed_after = self._unindexed_rows(tbl, idx_name)

        return {
            "worker_id": self.worker_id,
            "fencing_token": int(token),
            "version_before": version_before,
            "version_after": version_after,
            "unindexed_before": unindexed_before,
            "unindexed_after": unindexed_after,
        }

    # ------------------------------------------------------------------
    def __enter__(self) -> "IndexerCoordinator":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()
