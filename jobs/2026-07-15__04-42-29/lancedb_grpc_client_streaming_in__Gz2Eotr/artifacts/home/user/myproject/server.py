"""
gRPC server for vector ingestion (client-streaming) and nearest-neighbor search.

Environment variables
---------------------
LANCEDB_PATH  – directory where LanceDB stores its data
                (default: /home/user/myproject/lance_data)
ZEALT_RUN_ID  – run-specific suffix for the LanceDB table name
                (default: "default")

The server listens on 127.0.0.1:50051 and prints
"gRPC server listening on 127.0.0.1:50051" once it is ready.
"""

import os
import logging
import threading
from concurrent import futures

import grpc
import lancedb
import pyarrow as pa

import vector_pb2
import vector_pb2_grpc

# ── Configuration ────────────────────────────────────────────────────────────

VECTOR_DIM   = 16
BATCH_SIZE   = 100
LISTEN_ADDR  = "127.0.0.1:50051"

LANCEDB_PATH = os.environ.get("LANCEDB_PATH", "/home/user/myproject/lance_data")
ZEALT_RUN_ID = os.environ.get("ZEALT_RUN_ID", "default")
TABLE_NAME   = f"vectors_{ZEALT_RUN_ID}"

# ── PyArrow schema for the table ─────────────────────────────────────────────

VECTOR_SCHEMA = pa.schema([
    pa.field("id",       pa.int64()),
    pa.field("vector",   pa.list_(pa.float32(), VECTOR_DIM)),
    pa.field("metadata", pa.utf8()),
])

# ── LanceDB helpers ───────────────────────────────────────────────────────────

def _open_db_and_table():
    """Connect to LanceDB and (re-)create an empty table with the correct schema."""
    db = lancedb.connect(LANCEDB_PATH)

    # Drop the table if it already exists so we start fresh every server run.
    if TABLE_NAME in db.table_names():
        db.drop_table(TABLE_NAME)

    # Create an empty table from the schema.
    empty_batch = pa.RecordBatch.from_pydict(
        {"id": pa.array([], type=pa.int64()),
         "vector": pa.array([], type=pa.list_(pa.float32(), VECTOR_DIM)),
         "metadata": pa.array([], type=pa.utf8())},
        schema=VECTOR_SCHEMA,
    )
    table = db.create_table(TABLE_NAME, data=pa.Table.from_batches([empty_batch], schema=VECTOR_SCHEMA))
    return db, table


def _records_to_arrow(records: list[dict]) -> pa.Table:
    """Convert a list of record dicts to a PyArrow table matching VECTOR_SCHEMA."""
    ids      = pa.array([r["id"]       for r in records], type=pa.int64())
    vectors  = pa.array([r["vector"]   for r in records], type=pa.list_(pa.float32(), VECTOR_DIM))
    metadata = pa.array([r["metadata"] for r in records], type=pa.utf8())
    return pa.table({"id": ids, "vector": vectors, "metadata": metadata}, schema=VECTOR_SCHEMA)


# ── Servicer implementation ───────────────────────────────────────────────────

class VectorServicer(vector_pb2_grpc.VectorServiceServicer):

    def __init__(self, table, table_lock: threading.Lock):
        self._table      = table
        self._table_lock = table_lock

    # ── IngestVectors (client-streaming) ─────────────────────────────────────

    def IngestVectors(self, request_iterator, context):
        """
        Buffer incoming VectorRecord messages into fixed-size batches and flush
        each batch to LanceDB. Returns an IngestSummary when the stream ends.

        Dimension validation: if any record has the wrong number of floats the
        RPC is aborted with INVALID_ARGUMENT and *no* records from this call
        are committed (the pending buffer is simply discarded).
        """
        received = 0
        written  = 0
        batches  = 0
        pending  = []          # accumulator for the current batch

        for record in request_iterator:
            dim = len(record.vector)
            if dim != VECTOR_DIM:
                context.abort(
                    grpc.StatusCode.INVALID_ARGUMENT,
                    f"Expected vector dimension {VECTOR_DIM}, got {dim} "
                    f"(record id={record.id})",
                )
                return vector_pb2.IngestSummary()   # unreachable; abort raises

            pending.append({
                "id":       record.id,
                "vector":   list(record.vector),
                "metadata": record.metadata,
            })
            received += 1

            if len(pending) >= BATCH_SIZE:
                arrow_batch = _records_to_arrow(pending)
                with self._table_lock:
                    self._table.add(arrow_batch)
                written += len(pending)
                batches += 1
                pending.clear()

        # Flush any remaining records.
        if pending:
            arrow_batch = _records_to_arrow(pending)
            with self._table_lock:
                self._table.add(arrow_batch)
            written += len(pending)
            batches += 1
            pending.clear()

        return vector_pb2.IngestSummary(
            received=received,
            written=written,
            batches=batches,
        )

    # ── Search (unary) ────────────────────────────────────────────────────────

    def Search(self, request, context):
        """
        Exact brute-force kNN using LanceDB's vector search (L2 distance).
        Returns at most k results, ordered by ascending distance.
        """
        query = list(request.query_vector)
        k     = request.k

        if k <= 0:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"k must be a positive integer, got {k}",
            )
            return vector_pb2.SearchResponse()

        with self._table_lock:
            results_df = (
                self._table
                .search(query)
                .metric("l2")
                .limit(k)
                .to_pandas()
            )

        search_results = []
        for _, row in results_df.iterrows():
            search_results.append(
                vector_pb2.SearchResult(
                    id=int(row["id"]),
                    distance=float(row["_distance"]),
                    metadata=str(row["metadata"]),
                )
            )

        return vector_pb2.SearchResponse(results=search_results)


# ── Server bootstrap ──────────────────────────────────────────────────────────

def serve():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # Initialise LanceDB table (empty, correct schema) before accepting RPCs.
    _, table = _open_db_and_table()
    table_lock = threading.Lock()

    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    vector_pb2_grpc.add_VectorServiceServicer_to_server(
        VectorServicer(table, table_lock), server
    )
    server.add_insecure_port(LISTEN_ADDR)
    server.start()

    # This exact string is required by the test harness.
    print(f"gRPC server listening on {LISTEN_ADDR}", flush=True)
    logging.info("Table '%s' ready in '%s'", TABLE_NAME, LANCEDB_PATH)

    server.wait_for_termination()


if __name__ == "__main__":
    serve()
