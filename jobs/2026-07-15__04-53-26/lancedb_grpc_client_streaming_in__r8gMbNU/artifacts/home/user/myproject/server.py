"""gRPC server for vector ingestion and nearest-neighbor search backed by LanceDB.

Listens on 127.0.0.1:50051. The IngestVectors RPC is client-streaming: the
server buffers VectorRecord messages into fixed-size batches of 100, writes
each batch to LanceDB, and returns a single IngestSummary. Any streamed
record whose vector dimension does not match the table's fixed dimension
aborts the RPC with INVALID_ARGUMENT without leaving any partial batch in
the table.
"""

import os
import sys
import logging
from concurrent import futures

import grpc
import lancedb
import numpy as np
import pyarrow as pa

import vector_service_pb2
import vector_service_pb2_grpc

# ---- Configuration ---------------------------------------------------------

VECTOR_DIM = 16
BATCH_SIZE = 100

DEFAULT_LANCEDB_PATH = "/home/user/myproject/lance_data"
LANCEDB_PATH = os.environ.get("LANCEDB_PATH", DEFAULT_LANCEDB_PATH)

ZEALT_RUN_ID = os.environ.get("ZEALT_RUN_ID", "default")
TABLE_NAME = f"vectors_{ZEALT_RUN_ID}"

LISTEN_ADDRESS = "127.0.0.1:50051"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("vector_service.server")


# ---- Helpers ---------------------------------------------------------------


def vector_schema() -> pa.Schema:
    """Return the Arrow schema for the vectors table (16-dim float32 vectors)."""
    return pa.schema(
        [
            pa.field("id", pa.int32(), nullable=False),
            pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM), nullable=False),
            pa.field("metadata", pa.string(), nullable=False),
        ]
    )


def open_empty_table(db: lancedb.LanceDBConnection, name: str) -> "lancedb.table.Table":
    """Return an empty LanceDB table with the expected schema, recreating it if needed."""
    # Drop any pre-existing table so the server starts with a clean slate.
    try:
        db.drop_table(name)
    except Exception:  # noqa: BLE001
        pass
    return db.create_table(name, schema=vector_schema(), mode="create")


def _record_to_row(record: vector_service_pb2.VectorRecord) -> dict:
    return {
        "id": np.int32(record.id),
        "vector": np.asarray(record.vector, dtype=np.float32),
        "metadata": str(record.metadata),
    }


# ---- Servicer --------------------------------------------------------------


class VectorServiceServicer(vector_service_pb2_grpc.VectorServiceServicer):
    """gRPC servicer that ingests vectors into LanceDB and serves kNN search."""

    def __init__(self, db: lancedb.LanceDBConnection):
        self.db = db
        self.table_name = TABLE_NAME
        self.table = open_empty_table(db, self.table_name)
        log.info(
            "Initialized empty LanceDB table '%s' at %s (vector dim=%d)",
            self.table_name,
            LANCEDB_PATH,
            VECTOR_DIM,
        )

    # -- IngestVectors -------------------------------------------------------

    def IngestVectors(self, request_iterator, context):
        buffer: list = []
        received = 0
        written = 0
        batches = 0
        added_ids: list = []

        def _flush(rows):
            nonlocal written, batches
            if not rows:
                return
            self.table.add(rows, mode="append")
            written += len(rows)
            batches += 1
            added_ids.extend(int(r["id"]) for r in rows)

        try:
            for record in request_iterator:
                received += 1

                # Validate the vector dimension up front. We must not add the
                # offending record (or any other row in the current in-memory
                # buffer) to LanceDB. We also roll back any batches that were
                # already flushed during this RPC so the table stays free of
                # partial writes from this call.
                vec_len = len(record.vector)
                if vec_len != VECTOR_DIM:
                    msg = (
                        f"Vector dimension mismatch: expected {VECTOR_DIM}, "
                        f"got {vec_len}"
                    )
                    log.warning(
                        "Aborting IngestVectors: %s (received=%d, written=%d, batches=%d)",
                        msg,
                        received,
                        written,
                        batches,
                    )
                    self._rollback(added_ids)
                    context.abort(grpc.StatusCode.INVALID_ARGUMENT, msg)

                buffer.append(_record_to_row(record))

                if len(buffer) >= BATCH_SIZE:
                    _flush(buffer)
                    buffer = []

            # Stream ended cleanly: flush any remainder.
            _flush(buffer)

            log.info(
                "IngestVectors OK: received=%d written=%d batches=%d",
                received,
                written,
                batches,
            )
            return vector_service_pb2.IngestSummary(
                received=received, written=written, batches=batches
            )

        except Exception:
            # Make sure no rows from this RPC survive in the table.
            self._rollback(added_ids)
            raise

    def _rollback(self, ids):
        """Best-effort delete of rows this RPC had already flushed."""
        if not ids:
            return
        try:
            ids_csv = ",".join(str(int(i)) for i in ids)
            self.table.delete(f"id IN ({ids_csv})")
        except Exception as exc:  # noqa: BLE001
            log.warning("Rollback delete failed for ids=%s: %s", ids, exc)

    # -- Search ---------------------------------------------------------------

    def Search(self, request, context):
        if len(request.query_vector) != VECTOR_DIM:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"Query vector dimension mismatch: expected {VECTOR_DIM}, "
                f"got {len(request.query_vector)}",
            )

        query = np.asarray(request.query_vector, dtype=np.float32)
        k = int(request.k) if request.k > 0 else 0

        try:
            results = self.table.search(query).limit(k).to_list()
        except Exception as exc:  # noqa: BLE001
            context.abort(grpc.StatusCode.INTERNAL, f"Search failed: {exc}")

        hits = []
        for row in results:
            hits.append(
                vector_service_pb2.SearchHit(
                    id=int(row["id"]),
                    distance=float(row["_distance"]),
                    metadata=str(row["metadata"]),
                )
            )
        return vector_service_pb2.SearchResponse(hits=hits)


# ---- Server bootstrap ------------------------------------------------------


def serve() -> None:
    db = lancedb.connect(LANCEDB_PATH)
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=16))
    servicer = VectorServiceServicer(db)
    vector_service_pb2_grpc.add_VectorServiceServicer_to_server(servicer, server)

    bound_port = server.add_insecure_port(LISTEN_ADDRESS)
    if bound_port == 0:
        log.error("Failed to bind gRPC server to %s", LISTEN_ADDRESS)
        sys.exit(1)

    server.start()
    print(f"gRPC server listening on {LISTEN_ADDRESS}", flush=True)
    log.info("gRPC server listening on %s (port=%d)", LISTEN_ADDRESS, bound_port)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()