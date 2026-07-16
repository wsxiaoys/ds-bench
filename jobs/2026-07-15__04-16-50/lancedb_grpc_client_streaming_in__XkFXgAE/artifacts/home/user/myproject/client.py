import grpc
import vector_service_pb2
import vector_service_pb2_grpc

def ingest_vectors(records, address="127.0.0.1:50051"):
    """
    Ingests an iterable of records into the gRPC vector service.
    
    Parameters:
        records: An iterable of dicts with keys 'id' (int), 'vector' (list of float), 'metadata' (str).
        address: gRPC server address.
        
    Returns:
        A dict: {"received": int, "written": int, "batches": int}
    """
    with grpc.insecure_channel(address) as channel:
        stub = vector_service_pb2_grpc.VectorServiceStub(channel)
        
        def record_generator():
            for r in records:
                yield vector_service_pb2.VectorRecord(
                    id=r["id"],
                    vector=r["vector"],
                    metadata=r["metadata"]
                )
        
        response = stub.IngestVectors(record_generator())
        return {
            "received": response.received,
            "written": response.written,
            "batches": response.batches
        }

def search(query_vector, k, address="127.0.0.1:50051"):
    """
    Searches for the nearest neighbors of a query vector.
    
    Parameters:
        query_vector: A list of floats representing the query vector.
        k: Number of nearest neighbors to return.
        address: gRPC server address.
        
    Returns:
        A list of dicts, each with keys: 'id' (int), 'distance' (float), 'metadata' (str),
        ordered by ascending distance.
    """
    with grpc.insecure_channel(address) as channel:
        stub = vector_service_pb2_grpc.VectorServiceStub(channel)
        
        request = vector_service_pb2.SearchRequest(
            query_vector=query_vector,
            k=k
        )
        response = stub.Search(request)
        
        results = []
        for res in response.results:
            results.append({
                "id": res.id,
                "distance": res.distance,
                "metadata": res.metadata
            })
        return results
