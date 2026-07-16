"""Python client helpers for the vector ingestion + search gRPC service.

Two public functions are exposed:

* ``ingest_vectors(records, address=...)`` streams records to the server via
  the client-streaming ``IngestVectors`` RPC and returns a dict with the
  counts reported by the server's ``IngestSummary``. Server-side aborts
  propagate as ``grpc.RpcError`` (we do not swallow them).

* ``search(query_vector, k, address=...)`` issues a unary ``Search`` RPC and
  returns a list of hits ordered by ascending L2 distance.
"""

from typing import Iterable, List, Dict, Any, Optional

import grpc

import vector_service_pb2
import vector_service_pb2_grpc


# Default address matches the server's listen address.
DEFAULT_ADDRESS = "127.0.0.1:50051"


def _build_record(message: vector_service_pb2.VectorRecord) -> vector_service_pb2.VectorRecord:
    return message  # identity; placeholder for symmetry / clarity


def _record_iter(records: Iterable[Dict[str, Any]]):
    """Yield VectorRecord messages from an iterable of dicts."""
    for rec in records:
        vec = rec["vector"]
        yield vector_service_pb2.VectorRecord(
            id=int(rec["id"]),
            vector=[float(x) for x in vec],
            metadata=str(rec["metadata"]),
        )


def ingest_vectors(
    records: Iterable[Dict[str, Any]],
    address: str = DEFAULT_ADDRESS,
    *,
    timeout: Optional[float] = None,
) -> Dict[str, int]:
    """Stream ``records`` to the server via the client-streaming IngestVectors RPC.

    Parameters
    ----------
    records:
        Iterable of dicts with keys ``id`` (int), ``vector`` (iterable of
        float of the correct dimension), and ``metadata`` (str).
    address:
        ``host:port`` of the gRPC server.

    Returns
    -------
    dict
        ``{"received": int, "written": int, "batches": int}`` as reported
        by the server's ``IngestSummary``.

    Raises
    ------
    grpc.RpcError
        If the server aborts the RPC (e.g. INVALID_ARGUMENT on a
        dimension mismatch). The error is propagated to the caller
        without modification.
    """
    with grpc.insecure_channel(address) as channel:
        stub = vector_service_pb2_grpc.VectorServiceStub(channel)
        call = stub.IngestVectors(
            _record_iter(records),
            timeout=timeout,
        )
        return {
            "received": int(call.received),
            "written": int(call.written),
            "batches": int(call.batches),
        }


def search(
    query_vector: List[float],
    k: int,
    address: str = DEFAULT_ADDRESS,
    *,
    timeout: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Return the ``k`` nearest neighbors of ``query_vector`` (ascending L2).

    Each hit is a dict with keys ``id`` (int), ``distance`` (float), and
    ``metadata`` (str). The returned list has at most ``k`` entries.
    """
    request = vector_service_pb2.SearchRequest(
        query_vector=[float(x) for x in query_vector],
        k=int(k),
    )
    with grpc.insecure_channel(address) as channel:
        stub = vector_service_pb2_grpc.VectorServiceStub(channel)
        response = stub.Search(request, timeout=timeout)

    return [
        {
            "id": int(hit.id),
            "distance": float(hit.distance),
            "metadata": str(hit.metadata),
        }
        for hit in response.hits
    ]