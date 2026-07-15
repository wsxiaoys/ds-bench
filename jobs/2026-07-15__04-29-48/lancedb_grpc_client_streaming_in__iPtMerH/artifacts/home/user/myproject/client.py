#!/usr/bin/env python3
"""Python client helper for the vector ingestion / search gRPC service.

Public API
----------
``ingest_vectors(records, address="127.0.0.1:50051")``
    Stream an iterable of record dicts to the server via the client-streaming
    ``IngestVectors`` RPC and return a summary dict.

``search(query_vector, k, address="127.0.0.1:50051")``
    Run a unary similarity-search RPC and return the ranked hits.
"""

import os
import sys

import grpc

# Make the generated stubs importable when running from the project directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import vector_pb2
import vector_pb2_grpc

DEFAULT_ADDRESS = "127.0.0.1:50051"


def _record_iterator(records):
    """Yield ``VectorRecord`` protos from an iterable of dicts."""
    for rec in records:
        yield vector_pb2.VectorRecord(
            id=int(rec["id"]),
            vector=[float(x) for x in rec["vector"]],
            metadata=rec.get("metadata", "") if rec.get("metadata") is not None else "",
        )


def ingest_vectors(records, address=DEFAULT_ADDRESS):
    """Stream *records* to the server and return an ingestion summary.

    Parameters
    ----------
    records : iterable of dict
        Each dict must have keys ``id`` (int), ``vector`` (list of float) and
        ``metadata`` (str).
    address : str
        ``host:port`` of the gRPC server.

    Returns
    -------
    dict
        ``{"received": int, "written": int, "batches": int}``

    Raises
    ------
    grpc.RpcError
        Propagated unchanged if the server aborts the RPC (e.g. on a
        dimension-mismatch error).
    """
    with grpc.insecure_channel(address) as channel:
        stub = vector_pb2_grpc.VectorServiceStub(channel)
        summary = stub.IngestVectors(_record_iterator(records))
        return {
            "received": int(summary.received),
            "written": int(summary.written),
            "batches": int(summary.batches),
        }


def search(query_vector, k, address=DEFAULT_ADDRESS):
    """Run a similarity search and return ranked hits.

    Parameters
    ----------
    query_vector : list of float
        The query vector (must be 16-dimensional).
    k : int
        Maximum number of neighbours to return.
    address : str
        ``host:port`` of the gRPC server.

    Returns
    -------
    list of dict
        Each dict has keys ``id`` (int), ``distance`` (float) and
        ``metadata`` (str), ordered by ascending distance (nearest first).
        The list length is at most *k*.

    Raises
    ------
    grpc.RpcError
        Propagated unchanged if the server aborts the RPC.
    """
    request = vector_pb2.SearchRequest(
        query_vector=[float(x) for x in query_vector],
        k=int(k),
    )
    with grpc.insecure_channel(address) as channel:
        stub = vector_pb2_grpc.VectorServiceStub(channel)
        response = stub.Search(request)
        return [
            {
                "id": int(hit.id),
                "distance": float(hit.distance),
                "metadata": hit.metadata,
            }
            for hit in response.hits
        ]


if __name__ == "__main__":
    # Simple manual smoke-test when run directly.
    import random

    dims = 16
    sample = [
        {
            "id": i,
            "vector": [random.random() for _ in range(dims)],
            "metadata": "item-{}".format(i),
        }
        for i in range(10)
    ]
    print("ingest:", ingest_vectors(sample))
    q = sample[0]["vector"]
    print("search:", search(q, 3))