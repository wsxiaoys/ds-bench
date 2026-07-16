"""
Distributed LanceDB Indexer Coordinator with etcd Leader Election
=================================================================

Uses the etcd v3 HTTP/JSON gRPC-gateway (no external etcd client library
required; only the standard `requests` package is needed).

Election protocol
-----------------
1. Grant a lease with a bounded TTL.
2. Attempt an atomic compare-and-create (TXN) on a single election key:
   - compare: key's create_revision == 0  (key does not exist)
   - success: PUT key with our lease attached
   - failure: nothing (another leader already owns the key)
3. If the TXN succeeds → we are leader; the key's create_revision is our
   fencing token (globally monotonic in etcd's revision space).
4. A background daemon thread sends keepalive ticks at TTL/2 intervals.
5. On graceful resign → revoke lease + delete key immediately.
6. On crash simulation → stop the keepalive thread without revoking the
   lease; etcd expires it after TTL seconds, releasing the key.

Fencing
-------
Before touching LanceDB, run_maintenance() re-reads the election key and
confirms that (a) the key still exists, (b) it is bound to *our* lease, and
(c) its create_revision still equals our stored fencing token.  A stale
leader whose lease has expired will fail all three checks.
"""

from __future__ import annotations

import base64
import logging
import subprocess
import threading
import time
from typing import Any

import lancedb
import requests

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Small etcd v3 HTTP helper
# ---------------------------------------------------------------------------

def _b64(s: str | bytes) -> str:
    """Encode a string/bytes as base64 for the etcd JSON gateway."""
    if isinstance(s, str):
        s = s.encode()
    return base64.b64encode(s).decode()


def _from_b64(s: str) -> str:
    return base64.b64decode(s).decode()


class _Etcd:
    """Thin wrapper around the etcd v3 gRPC-gateway HTTP/JSON API."""

    def __init__(self, base_url: str, timeout: float = 5.0) -> None:
        self._base = base_url.rstrip("/")
        self._timeout = timeout

    def _post(self, path: str, body: dict) -> dict:
        resp = requests.post(
            f"{self._base}{path}", json=body, timeout=self._timeout
        )
        resp.raise_for_status()
        return resp.json()

    # --- leases ------------------------------------------------------------

    def lease_grant(self, ttl: int) -> str:
        """Return the lease ID as a decimal string."""
        data = self._post("/v3/lease/grant", {"TTL": ttl})
        return data["ID"]

    def lease_keepalive(self, lease_id: str) -> bool:
        """Send one keepalive tick.  Returns True if the lease is still alive."""
        try:
            data = self._post("/v3/lease/keepalive", {"ID": lease_id})
            result = data.get("result", data)
            return bool(result.get("TTL"))
        except Exception:
            return False

    def lease_revoke(self, lease_id: str) -> None:
        try:
            self._post("/v3/lease/revoke", {"ID": lease_id})
        except Exception:
            pass

    # --- kv ----------------------------------------------------------------

    def txn_create_if_absent(
        self, key: str, value: str, lease_id: str
    ) -> tuple[bool, int | None]:
        """
        Atomic compare-and-create.

        Returns (succeeded, create_revision).
        create_revision is None when succeeded is False.
        """
        key_b64 = _b64(key)
        val_b64 = _b64(value)
        body = {
            "compare": [
                {"target": "CREATE", "key": key_b64, "createRevision": "0"}
            ],
            "success": [
                {
                    "request_put": {
                        "key": key_b64,
                        "value": val_b64,
                        "lease": lease_id,
                    }
                }
            ],
            "failure": [],
        }
        data = self._post("/v3/kv/txn", body)
        if not data.get("succeeded"):
            return False, None

        # Read back the create_revision (the fencing token).
        kv = self.get(key)
        if kv is None:
            return False, None
        return True, int(kv["create_revision"])

    def get(self, key: str) -> dict | None:
        """Return the raw kv dict for *key*, or None if absent."""
        data = self._post("/v3/kv/range", {"key": _b64(key)})
        kvs = data.get("kvs", [])
        return kvs[0] if kvs else None

    def delete(self, key: str) -> None:
        try:
            self._post("/v3/kv/deleterange", {"key": _b64(key)})
        except Exception:
            pass


# ---------------------------------------------------------------------------
# IndexerCoordinator
# ---------------------------------------------------------------------------


class IndexerCoordinator:
    """
    Coordinates exactly-once LanceDB maintenance across a fleet of workers
    using etcd lease-based leader election.

    Parameters
    ----------
    worker_id : str
        Unique identifier for this worker instance.
    election_key : str
        etcd key used as the election mutex.
    ttl : int
        Lease TTL in seconds.  The keepalive thread fires every TTL/2 s.
    db_uri : str
        Path to the LanceDB dataset directory.
    table_name : str
        Name of the table to maintain.
    etcd_url : str
        Base URL of the etcd v3 gRPC-gateway.
    """

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
        self._election_key = election_key
        self._ttl = ttl
        self._db_uri = db_uri
        self._table_name = table_name

        self._etcd = _Etcd(etcd_url)

        # Protected by _lock
        self._lock = threading.Lock()
        self._lease_id: str | None = None
        self._fencing_token: int | None = None
        self._leader: bool = False

        # Keepalive background thread
        self._keepalive_thread: threading.Thread | None = None
        self._stop_keepalive = threading.Event()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def acquire(self) -> bool:
        """
        Non-blocking attempt to become leader.

        Returns True if this instance won leadership, False otherwise.
        On failure the lease is revoked immediately (no leak).
        """
        # Grant a fresh lease.
        try:
            lease_id = self._etcd.lease_grant(self._ttl)
        except Exception as exc:
            log.error("%s: lease grant failed: %s", self.worker_id, exc)
            return False

        # Attempt atomic compare-and-create.
        try:
            won, token = self._etcd.txn_create_if_absent(
                self._election_key, self.worker_id, lease_id
            )
        except Exception as exc:
            log.error("%s: txn failed: %s", self.worker_id, exc)
            self._etcd.lease_revoke(lease_id)
            return False

        if not won:
            # Another leader already holds the key — revoke our lease cleanly.
            self._etcd.lease_revoke(lease_id)
            log.debug("%s: lost election, follower", self.worker_id)
            return False

        # We won!  Record state and start keepalive.
        with self._lock:
            self._lease_id = lease_id
            self._fencing_token = token
            self._leader = True

        self._stop_keepalive.clear()
        t = threading.Thread(
            target=self._keepalive_loop,
            args=(lease_id,),
            daemon=True,
            name=f"keepalive-{self.worker_id}",
        )
        self._keepalive_thread = t
        t.start()

        log.info(
            "%s: became leader, lease=%s, fencing_token=%d",
            self.worker_id,
            lease_id,
            token,
        )
        return True

    def is_leader(self) -> bool:
        """True only while this instance currently holds leadership."""
        with self._lock:
            return self._leader

    def fencing_token(self) -> int | None:
        """
        The integer token for this leadership term, or None if not leader.
        Tokens are strictly increasing across successive terms because they
        derive from etcd's global create_revision counter.
        """
        with self._lock:
            if not self._leader:
                return None
            return self._fencing_token

    def run_maintenance(self) -> dict:
        """
        Run LanceDB maintenance (compaction + index rebuild) on the shared
        table.  Raises PermissionError if this instance is not the leader.

        The operation is fenced: before touching the table we confirm via
        etcd that we still own the election key with our current token.

        Returns a dict with keys:
            worker_id, fencing_token, version_before, version_after,
            unindexed_before, unindexed_after
        """
        with self._lock:
            if not self._leader:
                raise PermissionError(
                    f"{self.worker_id} is not the current leader"
                )
            lease_id = self._lease_id
            token = self._fencing_token

        # --- Fencing check ------------------------------------------------
        self._assert_still_leader(lease_id, token)

        # --- Open table ----------------------------------------------------
        db = lancedb.connect(self._db_uri)
        tbl = db.open_table(self._table_name)

        # --- Snapshot before stats ----------------------------------------
        version_before = tbl.list_versions()[-1]["version"]
        idx_name = self._get_index_name(tbl)
        stats_before = tbl.index_stats(idx_name)
        unindexed_before = stats_before.num_unindexed_rows

        # --- Fencing check again (double-check before mutation) -----------
        self._assert_still_leader(lease_id, token)

        # --- Maintenance ---------------------------------------------------
        # optimize() compacts small fragments AND merges the delta index,
        # effectively bringing unindexed rows into the ANN index.
        tbl.optimize()

        # --- Snapshot after stats -----------------------------------------
        version_after = tbl.list_versions()[-1]["version"]
        stats_after = tbl.index_stats(idx_name)
        unindexed_after = stats_after.num_unindexed_rows

        result = {
            "worker_id": self.worker_id,
            "fencing_token": token,
            "version_before": version_before,
            "version_after": version_after,
            "unindexed_before": unindexed_before,
            "unindexed_after": unindexed_after,
        }
        log.info("%s: maintenance done: %s", self.worker_id, result)
        return result

    def resign(self) -> None:
        """
        Graceful step-down: revoke the lease and delete the election key so
        that a waiting follower can win immediately.
        """
        with self._lock:
            if not self._leader:
                return
            lease_id = self._lease_id
            self._leader = False
            self._fencing_token = None
            self._lease_id = None

        # Stop the keepalive thread first.
        self._stop_keepalive.set()

        # Delete the election key explicitly before revoking the lease so
        # that followers can immediately re-try the TXN without waiting for
        # etcd to garbage-collect the key from the expired lease.
        self._etcd.delete(self._election_key)
        self._etcd.lease_revoke(lease_id)

        log.info("%s: resigned (lease revoked, key deleted)", self.worker_id)

    def simulate_crash(self) -> None:
        """
        Stop the keepalive thread WITHOUT revoking the lease.  Models a
        crashed or network-partitioned leader.  Leadership becomes available
        only after the TTL elapses and etcd expires the lease (which also
        removes the key, since it was attached via the lease).
        """
        self._stop_keepalive.set()

        with self._lock:
            # Mark ourselves as no longer leader locally but do NOT touch
            # etcd — the lease will expire on its own.
            self._leader = False
            self._fencing_token = None
            # Keep _lease_id set so close() can attempt a best-effort revoke
            # if called later (though in a real crash we would not get there).

        log.info(
            "%s: simulated crash — keepalive stopped, lease will expire after TTL",
            self.worker_id,
        )

    def close(self) -> None:
        """Release local resources/threads."""
        self._stop_keepalive.set()
        if self._keepalive_thread and self._keepalive_thread.is_alive():
            self._keepalive_thread.join(timeout=self._ttl + 1)
        log.debug("%s: closed", self.worker_id)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _keepalive_loop(self, lease_id: str) -> None:
        """Background daemon: send a keepalive every TTL/2 seconds."""
        interval = max(1, self._ttl // 2)
        while not self._stop_keepalive.wait(timeout=interval):
            alive = self._etcd.lease_keepalive(lease_id)
            if not alive:
                # Lease expired unexpectedly; mark ourselves as non-leader.
                with self._lock:
                    if self._lease_id == lease_id:
                        self._leader = False
                        self._fencing_token = None
                        self._lease_id = None
                log.warning(
                    "%s: keepalive failed — lease expired, stepping down",
                    self.worker_id,
                )
                return
            log.debug("%s: keepalive OK (lease=%s)", self.worker_id, lease_id)

    def _assert_still_leader(self, lease_id: str, token: int) -> None:
        """
        Confirm via etcd that we still own the election key with our token.
        Raises PermissionError if we are no longer the rightful leader.
        """
        kv = self._etcd.get(self._election_key)
        if kv is None:
            with self._lock:
                self._leader = False
                self._fencing_token = None
            raise PermissionError(
                f"{self.worker_id}: election key is gone — leadership lost"
            )
        if int(kv["create_revision"]) != token:
            with self._lock:
                self._leader = False
                self._fencing_token = None
            raise PermissionError(
                f"{self.worker_id}: fencing token mismatch "
                f"(expected {token}, got {kv['create_revision']}) — stale leader"
            )
        # Optionally verify the lease binding.
        kv_lease = kv.get("lease")
        if kv_lease and str(kv_lease) != str(lease_id):
            with self._lock:
                self._leader = False
                self._fencing_token = None
            raise PermissionError(
                f"{self.worker_id}: lease mismatch — leadership lost"
            )

    @staticmethod
    def _get_index_name(tbl: Any) -> str:
        indices = tbl.list_indices()
        return indices[0].name if indices else "vector_idx"
