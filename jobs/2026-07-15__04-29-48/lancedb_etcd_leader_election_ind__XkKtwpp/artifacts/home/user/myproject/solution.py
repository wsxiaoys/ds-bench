"""Distributed LanceDB indexer coordinator with etcd v3 leader election.

A fleet of identical worker processes shares one LanceDB dataset.  Table
maintenance (fragment compaction via ``optimize()`` plus vector-index rebuilds)
is expensive and MUST be performed by exactly one worker at a time.  This module
implements a coordinator that uses a *local* etcd v3 instance for lease-based
leader election so that only the elected leader runs maintenance while every
follower stays idle.

The etcd communication uses the pure-HTTP/JSON gRPC-gateway exposed at
``http://127.0.0.1:2379`` (``requests`` only -- no etcd client library needed).
All ``key``/``value`` fields exchanged with the gateway are base64-encoded, as
required by the etcd v3 JSON mapping.

Leader-election design
----------------------
* A candidate grants an etcd lease with a bounded ``ttl``.
* It then issues an atomic compare-and-create transaction on a single election
  key bound to that lease: the transaction succeeds only when the key's
  ``create_revision`` is ``0`` (i.e. the key does not exist yet).  Only the
  winner becomes leader.  Losers revoke their just-granted lease so nothing
  leaks.
* The election key's ``create_revision`` is a natural, globally-monotonic
  **fencing token**: every new leadership term receives a strictly greater
  token than every previous term, so a stale leader can be detected and
  rejected.
* A background keepalive thread refreshes the lease for as long as the leader
  is healthy.
* Graceful step-down (``resign``) revokes the lease and removes the key so a
  follower wins immediately.  A crash (``simulate_crash``) simply stops
  refreshing the lease; the lease (and the key bound to it) expire after the
  TTL, after which a follower takes over.
* Maintenance is fenced: right before touching the table the leader re-checks
  against etcd that it still owns the election key with its own term's token.
"""

from __future__ import annotations

import base64
import threading
import time
from typing import Optional

import requests

try:  # LanceDB is only needed when maintenance actually runs.
    import lancedb
except Exception:  # pragma: no cover - import-time guard
    lancedb = None  # type: ignore[assignment]


class IndexerCoordinator:
    """Lease-based leader-election coordinator backed by etcd v3.

    Parameters
    ----------
    worker_id:
        Human-readable identifier for this worker; stored as the value of the
        election key.
    election_key:
        The single etcd key used for leader election.
    ttl:
        Lease time-to-live in seconds.  On an ungraceful crash the leadership
        becomes available again only after this many seconds elapse.
    db_uri / table_name:
        Location and name of the shared LanceDB table to maintain.
    etcd_url:
        Base URL of the etcd v3 HTTP/JSON gateway.
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
        self.election_key = election_key
        self.ttl = int(ttl)
        self.db_uri = db_uri
        self.table_name = table_name
        self.etcd_url = etcd_url.rstrip("/")

        # Leadership state -------------------------------------------------
        self.lease_id: Optional[int] = None
        self._fencing_token: Optional[int] = None

        # Keepalive machinery ----------------------------------------------
        self._lock = threading.Lock()
        self._stop_keepalive = threading.Event()
        self._keepalive_thread: Optional[threading.Thread] = None
        self._closed = False

    # ------------------------------------------------------------------ #
    # etcd JSON-gateway helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _b64(data) -> str:
        """Base64-encode a str/bytes value for the etcd JSON gateway."""
        if isinstance(data, str):
            data = data.encode("utf-8")
        return base64.b64encode(data).decode("ascii")

    def _post(self, path: str, payload: dict) -> dict:
        """POST a JSON payload to the etcd gateway and return the decoded JSON."""
        resp = requests.post(self.etcd_url + path, json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def _grant_lease(self) -> int:
        resp = self._post("/v3/lease/grant", {"TTL": self.ttl})
        return int(resp["ID"])

    def _revoke_lease(self, lease_id: int) -> None:
        try:
            self._post("/v3/lease/revoke", {"ID": lease_id})
        except Exception:
            # Revoking an already-expired/revoked lease is a no-op; ignore.
            pass

    def _keepalive_once(self, lease_id: int) -> dict:
        return self._post("/v3/lease/keepalive", {"ID": lease_id})

    def _range_key(self) -> Optional[dict]:
        """Return the raw KV record for the election key, or ``None``."""
        resp = self._post("/v3/kv/range", {"key": self._b64(self.election_key)})
        kvs = resp.get("kvs")
        if not kvs:
            return None
        return kvs[0]

    def _delete_key(self) -> None:
        try:
            self._post("/v3/kv/deleterange", {"key": self._b64(self.election_key)})
        except Exception:
            pass

    # ------------------------------------------------------------------ #
    # Ownership verification (the source of truth for "am I leader?")
    # ------------------------------------------------------------------ #
    def _check_ownership(self) -> tuple[bool, Optional[int]]:
        """Verify against etcd that this instance currently owns leadership.

        Returns ``(owns, token)`` where ``owns`` is True only when the election
        key exists, is bound to *our* lease, and its ``create_revision`` equals
        our current fencing token.  ``token`` is the key's create revision (the
        fencing token) when we own it, otherwise ``None``.
        """
        if self.lease_id is None or self._fencing_token is None:
            return False, None
        kv = self._range_key()
        if kv is None:
            return False, None
        try:
            kv_lease = int(kv.get("lease", 0))
            kv_create = int(kv.get("create_revision", 0))
        except (TypeError, ValueError):
            return False, None
        if kv_lease == self.lease_id and kv_create == self._fencing_token:
            return True, self._fencing_token
        return False, None

    # ------------------------------------------------------------------ #
    # Keepalive thread
    # ------------------------------------------------------------------ #
    def _keepalive_loop(self, lease_id: int) -> None:
        """Background loop refreshing the lease while the leader is healthy."""
        # Refresh roughly every ttl/3 seconds, but never less than 1s.
        interval = max(1.0, self.ttl / 3.0)
        while not self._stop_keepalive.is_set():
            try:
                resp = self._keepalive_once(lease_id)
                result = resp.get("result") or {}
                ttl_remaining = result.get("TTL")
                # An empty result or TTL==0 means the lease is gone/revoke/expired.
                if not result or ttl_remaining in (None, 0, "0"):
                    break
            except Exception:
                # Network errors: stop trying; the lease will expire on its own.
                break
            # Wait, but wake up promptly if asked to stop.
            self._stop_keepalive.wait(interval)

    def _start_keepalive(self, lease_id: int) -> None:
        self._stop_keepalive.clear()
        t = threading.Thread(
            target=self._keepalive_loop,
            args=(lease_id,),
            name="etcd-keepalive-%s" % self.worker_id,
            daemon=True,
        )
        t.start()
        self._keepalive_thread = t

    def _stop_keepalive_thread(self) -> None:
        self._stop_keepalive.set()
        t = self._keepalive_thread
        if t is not None and t.is_alive():
            t.join(timeout=5)
        self._keepalive_thread = None
        self._stop_keepalive.clear()

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #
    def acquire(self) -> bool:
        """Non-blocking attempt to become leader.

        Returns ``True`` only if this instance won leadership, ``False``
        otherwise.  On failure no lease is leaked.
        """
        if self._closed:
            return False
        # If we already hold leadership, report success.
        owns, _ = self._check_ownership()
        if owns:
            return True

        # Grant a fresh lease for this attempt.
        lease_id = self._grant_lease()
        key_b64 = self._b64(self.election_key)
        val_b64 = self._b64(self.worker_id)

        # Atomic compare-and-create: succeed only if the key does not exist
        # (create_revision == 0).  Leases the key to our lease on success.
        txn = {
            "compare": [
                {
                    "key": key_b64,
                    "target": "CREATE",
                    "result": "EQUAL",
                    "create_revision": 0,
                }
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
        }

        try:
            resp = self._post("/v3/kv/txn", txn)
        except Exception:
            # Could not reach etcd / txn failed to even be submitted: clean up.
            self._revoke_lease(lease_id)
            return False

        succeeded = resp.get("succeeded", False)
        if not succeeded:
            # Someone else is leader.  Revoke our lease so it does not leak.
            self._revoke_lease(lease_id)
            return False

        # We won.  Read the key back to obtain the create_revision, which is
        # the globally-monotonic fencing token for this leadership term.
        kv = self._range_key()
        if kv is None:
            # Extremely unlikely race (key vanished immediately).  Treat as
            # not leader and clean up.
            self._revoke_lease(lease_id)
            return False

        with self._lock:
            self.lease_id = lease_id
            self._fencing_token = int(kv["create_revision"])

        # Begin keeping the lease alive from a background thread.
        self._start_keepalive(lease_id)
        return True

    def is_leader(self) -> bool:
        """``True`` only while this instance currently holds leadership."""
        owns, _ = self._check_ownership()
        return owns

    def fencing_token(self) -> Optional[int]:
        """The fencing token for this instance's current term, or ``None``.

        Tokens are strictly increasing across successive terms (they are etcd
        ``create_revision`` values, which form a globally monotonic sequence).
        """
        owns, token = self._check_ownership()
        return token if owns else None

    def run_maintenance(self) -> dict:
        """Run LanceDB maintenance as the current leader.

        Raises ``PermissionError`` if this instance is not the current leader
        (including the case where it lost leadership between the initial check
        and touching the table -- the *fencing* re-check).

        Returns a dict with exactly the keys ``worker_id``, ``fencing_token``,
        ``version_before``, ``version_after``, ``unindexed_before``,
        ``unindexed_after``.
        """
        # First check + fencing re-check against etcd (single source of truth).
        owns, token = self._check_ownership()
        if not owns or token is None:
            raise PermissionError(
                "worker %r is not the current leader" % self.worker_id
            )

        # Defensive fencing: re-read etcd once more right before mutating the
        # table to guarantee we still own the key with our term's token.
        owns2, token2 = self._check_ownership()
        if not owns2 or token2 != token:
            raise PermissionError(
                "worker %r lost leadership before maintenance" % self.worker_id
            )

        if lancedb is None:
            raise RuntimeError("lancedb is not available")

        db = lancedb.connect(self.db_uri)
        tbl = db.open_table(self.table_name)

        # Resolve the vector index name (the table is seeded with exactly one).
        indices = tbl.list_indices()
        index_name = indices[0].name if indices else "vector_idx"

        version_before = int(tbl.version)
        unindexed_before = self._unindexed_rows(tbl, index_name)

        # Maintenance: compact small fragments and rebuild/update the vector
        # index.  ``optimize()`` is idempotent -- no rows are ever lost; the
        # row count remains unchanged.
        tbl.optimize()

        # Re-open the table to observe the freshly committed version/stats.
        tbl = db.open_table(self.table_name)
        version_after = int(tbl.version)
        unindexed_after = self._unindexed_rows(tbl, index_name)

        return {
            "worker_id": self.worker_id,
            "fencing_token": int(token),
            "version_before": version_before,
            "version_after": version_after,
            "unindexed_before": unindexed_before,
            "unindexed_after": unindexed_after,
        }

    @staticmethod
    def _unindexed_rows(tbl, index_name: str) -> int:
        """Return the number of unindexed rows for ``index_name`` (0 if N/A)."""
        try:
            stats = tbl.index_stats(index_name)
        except Exception:
            return 0
        if stats is None:
            return 0
        try:
            return int(stats.num_unindexed_rows)
        except AttributeError:
            # Older LanceDB may expose a dict-like statistics object.
            try:
                return int(stats.get("num_unindexed_rows", 0))
            except Exception:
                return 0

    def resign(self) -> None:
        """Graceful step-down: revoke the lease and delete the election key.

        A follower can win immediately afterwards.
        """
        with self._lock:
            lease_id = self.lease_id
        # Stop refreshing the lease first so we do not fight our own revoke.
        self._stop_keepalive_thread()
        if lease_id is not None:
            # Revoking the lease auto-deletes the key bound to it; delete it
            # explicitly as well for belt-and-suspenders.
            self._delete_key()
            self._revoke_lease(lease_id)
        with self._lock:
            self.lease_id = None
            self._fencing_token = None

    def simulate_crash(self) -> None:
        """Model a crashed/partitioned leader.

        Stops refreshing the lease WITHOUT revoking it.  The lease (and the
        election key bound to it) expire after the TTL elapses; only then does
        leadership become available again.
        """
        # Stop keepalive but leave the lease in place so it expires on its own.
        self._stop_keepalive_thread()
        # We intentionally do NOT clear lease_id / fencing token here: the
        # leader still "holds" leadership until the lease actually expires,
        # after which is_leader()/fencing_token() naturally return False/None.

    def close(self) -> None:
        """Release local resources/threads (does not necessarily resign)."""
        self._closed = True
        self._stop_keepalive_thread()