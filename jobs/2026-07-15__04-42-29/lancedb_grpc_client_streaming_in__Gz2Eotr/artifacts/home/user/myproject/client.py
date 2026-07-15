"""
Client helper for the VectorService gRPC microservice.

Public API
----------
ingest_vectors(records, address="127.0.0.1:50051")
    Stream an iterable of record dicts to the server.
    Returns {"received": int, "written": int, "batches": int}.
    Propagates grpc.RpcError on server-side failures (do NOT catch it here).

search(query_vector, k, address="127.0.0.1:50051")
    Query the nearest k neighbours of query_vector.
    Returns a list of dicts [{"id": int, "distance": float, "metadata": str}, ...]
    ordered by ascending distance (nearest first).
"""

import grpc

import vector_pb2
import vector_pb2_grpc


def _record_generator(records):
    """Yield VectorRecord proto messages from an iterable of dicts."""
    for rec in records:
        yield vector_pb2.VectorRecord(
            id=int(rec["id"]),
            vector=[float(v) for v in rec["vector"]],
            metadata=str(rec["metadata"]),
        )


def ingest_vectors(records, address="127.0.0.1:50051"):
    """
    Stream *records* to the server via the client-streaming IngestVectors RPC.

    Parameters
    ----------
    records : iterable of dict
        Each dict must have keys:
          "id"       – int
          "vector"   – list of float
          "metadata" – str
    address : str
        gRPC server address (host:port).

    Returns
    -------
    dict
        {"received": int, "written": int, "batches": int}

    Raises
    ------
    grpc.RpcError
        Re-raised as-is on any server-side error (e.g. INVALID_ARGUMENT for
        wrong vector dimension). The caller is responsible for handling it.
    """
    with grpc.insecure_channel(address) as channel:
        stub    = vector_pb2_grpc.VectorServiceStub(channel)
        summary = stub.IngestVectors(_record_generator(records))
        return {
            "received": int(summary.received),
            "written":  int(summary.written),
            "batches":  int(summary.batches),
        }


def search(query_vector, k, address="127.0.0.1:50051"):
    """
    Search the vector store for the k nearest neighbours of *query_vector*.

    Parameters
    ----------
    query_vector : list of float
        The query embedding (must have the same dimension as stored vectors).
    k : int
        Maximum number of results to return.
    address : str
        gRPC server address (host:port).

    Returns
    -------
    list of dict
        Each dict: {"id": int, "distance": float, "metadata": str}
        Ordered by ascending distance (nearest neighbour first).
    """
    with grpc.insecure_channel(address) as channel:
        stub     = vector_pb2_grpc.VectorServiceStub(channel)
        request  = vector_pb2.SearchRequest(
            query_vector=[float(v) for v in query_vector],
            k=int(k),
        )
        response = stub.Search(request)
        return [
            {
                "id":       int(result.id),
                "distance": float(result.distance),
                "metadata": str(result.metadata),
            }
            for result in response.results
        ]
