import time
import datetime
import lancedb
import pyarrow as pa

class LoggedSearcher:
    """
    LoggedSearcher wraps vector similarity search against a LanceDB table
    and persists an audit row for each search to a query_logs table.
    """
    def __init__(self, db_uri: str, articles_table: str, logs_table: str):
        self.db_uri = db_uri
        self.articles_table_name = articles_table
        self.logs_table_name = logs_table
        
        # Connect to the database and open the articles table
        self.db = lancedb.connect(self.db_uri)
        self.articles_table = self.db.open_table(self.articles_table_name)
        
        # Lazy initialization for the query logs table
        self._logs_table = None

    def _get_or_create_logs_table(self):
        if self._logs_table is None:
            if self.logs_table_name in self.db.table_names():
                self._logs_table = self.db.open_table(self.logs_table_name)
            else:
                schema = pa.schema([
                    pa.field("query_id", pa.string()),
                    pa.field("user_id", pa.string()),
                    pa.field("query_text", pa.string()),
                    pa.field("ts", pa.timestamp("us", tz="UTC")),
                    pa.field("latency_ms", pa.float64()),
                    pa.field("hit_count", pa.int64()),
                    pa.field("top_ids", pa.list_(pa.int64()))
                ])
                self._logs_table = self.db.create_table(self.logs_table_name, schema=schema)
        return self._logs_table

    def search(self, query_vector, top_k, query_id, user_id, query_text=""):
        """
        Runs a vector similarity search against the articles table for the given query vector,
        returning the top top_k hits, and logging the search to the query logs table.
        """
        # Measure wall-clock latency of the search
        start_time = time.perf_counter()
        hits = self.articles_table.search(query_vector).limit(top_k).to_list()
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        
        # Ensure latency_ms is strictly positive
        if latency_ms <= 0.0:
            latency_ms = 1e-9
            
        # Extract ordered list of returned ids (plain Python ints)
        top_ids = [int(hit["id"]) for hit in hits if "id" in hit]
        
        # Log timestamp taken at logging time
        now_ts = datetime.datetime.now(datetime.timezone.utc)
        
        # Prepare and append audit row to the logs table
        audit_row = {
            "query_id": str(query_id) if query_id is not None else "",
            "user_id": str(user_id) if user_id is not None else "",
            "query_text": str(query_text) if query_text is not None else "",
            "ts": now_ts,
            "latency_ms": float(latency_ms),
            "hit_count": int(len(hits)),
            "top_ids": top_ids
        }
        
        logs_table = self._get_or_create_logs_table()
        logs_table.add([audit_row])
        
        return hits
