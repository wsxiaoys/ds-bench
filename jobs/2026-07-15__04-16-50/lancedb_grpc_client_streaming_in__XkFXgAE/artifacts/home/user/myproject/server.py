import os
import sys
import grpc
from concurrent import futures
import threading
import lancedb
import pyarrow as pa

# Import generated classes
import vector_service_pb2
import vector_service_pb2_grpc

class VectorServiceServicer(vector_service_pb2_grpc.VectorServiceServicer):
    def __init__(self, table):
        self.table = table
        self._lock = threading.Lock()

    def IngestVectors(self, request_iterator, context):
        with self._lock:
            start_version = self.table.version
            received_count = 0
            written_count = 0
            batches_count = 0
            
            batch = []
            try:
                for record in request_iterator:
                    received_count += 1
                    # Validate dimension
                    if len(record.vector) != 16:
                        context.abort(
                            grpc.StatusCode.INVALID_ARGUMENT,
                            f"Invalid vector dimension: expected 16, got {len(record.vector)}"
                        )
                    
                    batch.append({
                        "id": record.id,
                        "vector": list(record.vector),
                        "metadata": record.metadata
                    })
                    
                    if len(batch) == 100:
                        self.table.add(batch)
                        written_count += len(batch)
                        batches_count += 1
                        batch = []
                
                if batch:
                    self.table.add(batch)
                    written_count += len(batch)
                    batches_count += 1
                    batch = []
                    
                return vector_service_pb2.IngestSummary(
                    received=received_count,
                    written=written_count,
                    batches=batches_count
                )
            except Exception as e:
                # Rollback to start_version
                try:
                    self.table.restore(start_version)
                except Exception as restore_err:
                    print(f"Error restoring table: {restore_err}", file=sys.stderr)
                raise e

    def Search(self, request, context):
        if len(request.query_vector) != 16:
            context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"Query vector dimension must be 16, got {len(request.query_vector)}"
            )
        
        try:
            # Vector search with default L2 (Euclidean) distance
            k = request.k if request.k > 0 else 10
            # LanceDB search
            results_list = self.table.search(list(request.query_vector)).metric("l2").limit(k).to_list()
            
            results = []
            for item in results_list:
                results.append(vector_service_pb2.SearchResult(
                    id=item["id"],
                    distance=item["_distance"],
                    metadata=item["metadata"]
                ))
            return vector_service_pb2.SearchResponse(results=results)
        except Exception as e:
            context.abort(grpc.StatusCode.INTERNAL, f"Internal error during search: {str(e)}")

def serve():
    lancedb_path = os.environ.get("LANCEDB_PATH", "/home/user/myproject/lance_data")
    zealt_run_id = os.environ.get("ZEALT_RUN_ID", "")
    table_name = f"vectors_{zealt_run_id}"
    
    # Connect to LanceDB
    db = lancedb.connect(lancedb_path)
    
    # Create schema
    schema = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("vector", pa.list_(pa.float32(), 16)),
        pa.field("metadata", pa.string())
    ])
    
    # Create/Overwrite an empty table
    table = db.create_table(table_name, schema=schema, mode="overwrite")
    
    # Start gRPC server
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    vector_service_pb2_grpc.add_VectorServiceServicer_to_server(
        VectorServiceServicer(table), server
    )
    server.add_insecure_port("127.0.0.1:50051")
    server.start()
    
    print("gRPC server listening on 127.0.0.1:50051", flush=True)
    
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        server.stop(0)

if __name__ == "__main__":
    serve()
