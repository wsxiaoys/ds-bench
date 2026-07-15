#!/usr/bin/env python3
"""gRPC server that ingests vector records into LanceDB and serves kNN search.

The server exposes two RPCs:
  * IngestVectors  – client-streaming; buffers records into batches of 100
                     and writes each batch to a LanceDB table.
  * Search         – unary; returns the k nearest neighbors (L2 distance).

Storage is an embedded LanceDB database rooted at ``LANCEDB_PATH`` (default
``/home/user/myproject/lance_data``).  The table is named
``vectors_${ZEALT_RUN_ID}`` and is created empty (with the correct 16-dim
float32 schema) on every startup.
"""

import os
import sys
from concurrent import futures

import grpc
import lancedb
import pyarrow as pa

# Make the generated stubs importable when running from the project directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vector_pb2
import vector_pb2_grpc

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
VECTOR_DIM = 16
BATCH_SIZE = 100
SERVER_ADDRESS = "127.0.0.1:50051"
LANCEDB_PATH = os.environ.get("LANCEDB_PATH", "/home/user/myproject/lance_data")
TABLE_NAME = "vectors_{}".format(os.environ.get("ZEALT_RUN_ID", "default"))

# PyArrow schema: a fixed-size list of 16 float32 values for the vector column.
SCHEMA = pa.schema(
    [
        pa.field("id", pa.int64()),
        pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
        pa.field("metadata", pa.string()),
    ]
)


class VectorServiceServicer(vector_pb2_grpc.VectorServiceServicer):
    """Implementation of the VectorService gRPC service."""

    def __init__(self, table):
        self.table = table

    # -- public RPCs --------------------------------------------------------
    def IngestVectors(self, request_iterator, context):
        """Client-streaming ingestion.

        Buffers incoming ``VectorRecord`` messages and flushes them to LanceDB
        in fixed-size batches (100).  If any record has the wrong vector
        dimension the RPC is aborted with ``INVALID_ARGUMENT`` and *all* rows
        written during this RPC are rolled back so the table is left in the
        same state it was in before the call.
        """
        start_version = self.table.version  # snapshot for potential rollback
        received = 0
        written = 0
        batches = 0
        buffer = []
        error_code = None
        error_msg = None

        try:
            for record in request_iterator:
                received += 1

                # --- dimension validation --------------------------------
                if len(record.vector) != VECTOR_DIM:
                    # Roll back any partial writes from this RPC before aborting
                    # so the table contains nothing from this call.
                    self._rollback(start_version)
                    error_code = grpc.StatusCode.INVALID_ARGUMENT
                    error_msg = "vector dimension mismatch: expected {}, got {}".format(
                        VECTOR_DIM, len(record.vector)
                    )
                    break

                buffer.append(
                    {
                        "id": int(record.id),
                        "vector": [float(x) for x in record.vector],
                        "metadata": record.metadata,
                    }
                )

                # --- flush a full batch ----------------------------------
                if len(buffer) >= BATCH_SIZE:
                    self.table.add(buffer)
                    written += len(buffer)
                    batches += 1
                    buffer = []
            else:
                # --- flush any remainder when the stream ends -------------
                # (this ``else`` runs only if the loop was *not* broken)
                if buffer:
                    self.table.add(buffer)
                    written += len(buffer)
                    batches += 1
                    buffer = []

        except Exception as exc:  # pragma: no cover - defensive
            # Any unexpected error (e.g. LanceDB write failure): roll back.
            self._rollback(start_version)
            error_code = grpc.StatusCode.INTERNAL
            error_msg = "ingestion failed: {}".format(exc)

        # ``context.abort`` raises a plain ``Exception`` to terminate the RPC;
        # it must be called *outside* any ``try/except Exception`` block so
        # that it is not accidentally re-caught.
        if error_code is not None:
            context.abort(error_code, error_msg)

        return vector_pb2.IngestSummary(
            received=received, written=written, batches=batches
        )

    def Search(self, request, context):
        """Unary nearest-neighbour search (exact brute-force kNN, L2)."""
        query = list(request.query_vector)

        if len(query) != VECTOR_DIM:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                "query vector dimension mismatch: expected {}, got {}".format(
                    VECTOR_DIM, len(query)
                ),
            )

        k = int(request.k)
        if k <= 0:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                "k must be a positive integer, got {}".format(k),
            )

        # If the table is empty there is nothing to search.
        if self.table.count_rows() == 0:
            return vector_pb2.SearchResponse(hits=[])

        results = self.table.search(query).limit(k).to_list()

        hits = []
        for row in results:
            hits.append(
                vector_pb2.SearchHit(
                    id=int(row["id"]),
                    distance=float(row["_distance"]),
                    metadata=row.get("metadata", "") if row.get("metadata") is not None else "",
                )
            )

        return vector_pb2.SearchResponse(hits=hits)

    # -- helpers ------------------------------------------------------------
    def _rollback(self, start_version):
        """Restore the LanceDB table to *start_version*, removing any rows
        written during the current RPC."""
        try:
            self.table.checkout(start_version)
            self.table.restore()
            self.table.checkout_latest()
        except Exception:
            # Best-effort rollback; if it fails there is little we can do.
            pass


def _get_table():
    """Create / overwrite an empty LanceDB table with the correct schema."""
    os.makedirs(LANCEDB_PATH, exist_ok=True)
    db = lancedb.connect(LANCEDB_PATH)

    # ``mode='overwrite'`` guarantees the table exists and is empty.
    table = db.create_table(TABLE_NAME, schema=SCHEMA, mode="overwrite")
    return table


def serve():
    """Start the gRPC server."""
    table = _get_table()

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    vector_pb2_grpc.add_VectorServiceServicer_to_server(
        VectorServiceServicer(table), server
    )
    server.add_insecure_port(SERVER_ADDRESS)
    server.start()
    print("gRPC server listening on {}".format(SERVER_ADDRESS), flush=True)
    server.wait_for_termination()


if __name__ == "__main__":
    serve()