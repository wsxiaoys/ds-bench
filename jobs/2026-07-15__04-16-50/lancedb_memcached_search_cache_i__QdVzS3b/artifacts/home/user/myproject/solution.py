import hashlib
import json
import lancedb
import numpy as np
from pymemcache.client.base import Client

class CachedSearcher:
    def __init__(self, db_path, table_name, memcached_host="127.0.0.1", memcached_port=11211, ttl_seconds=300):
        self.db_path = db_path
        self.table_name = table_name
        self.memcached_host = memcached_host
        self.memcached_port = memcached_port
        self.ttl_seconds = ttl_seconds
        
        # Connect to LanceDB
        self.db = lancedb.connect(db_path)
        self.table = self.db.open_table(table_name)
        
        # Connect to Memcached with default_noreply=False to ensure synchronous behavior and correct return values
        self.client = Client((memcached_host, memcached_port), default_noreply=False)
        
        # Define a unique key for the table's dataset version in memcached
        self.version_key = f"version:{table_name}"
        
        # Ensure the version is initialized in memcached
        self.current_version()

    def _get_cache_key(self, query_vector, k, filter_str, dataset_version) -> str:
        # Canonical float32 byte representation of the query vector
        vector_bytes = np.array(query_vector, dtype=np.float32).tobytes()
        
        hasher = hashlib.sha256()
        hasher.update(self.table_name.encode('utf-8'))
        hasher.update(str(dataset_version).encode('utf-8'))
        hasher.update(str(k).encode('utf-8'))
        
        f_str = filter_str if filter_str is not None else ""
        hasher.update(f_str.encode('utf-8'))
        hasher.update(vector_bytes)
        
        return f"search:{hasher.hexdigest()}"

    def current_version(self) -> int:
        val = self.client.get(self.version_key)
        if val is None:
            # Try to initialize the version to 1 atomically
            success = self.client.add(self.version_key, b'1')
            if success:
                return 1
            else:
                # If add failed, someone else initialized it first; retrieve the value
                val = self.client.get(self.version_key)
                if val is None:
                    return 1
        return int(val)

    def increment_version(self) -> int:
        val = self.client.incr(self.version_key, 1)
        if val is None:
            # Key didn't exist or was evicted, try to initialize to 1 atomically
            success = self.client.add(self.version_key, b'1')
            if not success:
                # Someone else initialized it in the meantime, increment it
                val = self.client.incr(self.version_key, 1)
                if val is None:
                    return 1
            else:
                return 1
        return val

    def search(self, query_vector, k=10, filter=None) -> list[dict]:
        # 1. Get current dataset version from memcached
        version = self.current_version()
        
        # 2. Build the stable cache key
        cache_key = self._get_cache_key(query_vector, k, filter, version)
        
        # 3. Check for cache hit in memcached
        cached_val = self.client.get(cache_key)
        if cached_val is not None:
            # Cache hit! Return the deserialized list
            return json.loads(cached_val.decode('utf-8'))
        
        # 4. Cache miss - run LanceDB search
        # Ensure we observe the latest committed state of the table
        self.table.checkout_latest()
        
        # Cast query vector to float32 for the LanceDB query
        query_np = np.array(query_vector, dtype=np.float32)
        
        # Build the vector search query (L2 metric is default for LanceDB search, but we specify it for clarity)
        query = self.table.search(query_np).metric("l2").limit(k)
        if filter:
            query = query.where(filter)
            
        raw_results = query.to_list()
        
        # Format results to contain exactly id, category, and _distance
        formatted_results = []
        for item in raw_results:
            formatted_results.append({
                'id': int(item['id']),
                'category': str(item['category']),
                '_distance': float(item['_distance'])
            })
            
        # Ensure results are sorted by ascending _distance
        formatted_results.sort(key=lambda x: x['_distance'])
        
        # 5. Store serialized result in memcached with configured TTL
        serialized = json.dumps(formatted_results).encode('utf-8')
        self.client.set(cache_key, serialized, expire=self.ttl_seconds)
        
        return formatted_results

    def add(self, rows) -> None:
        # Append the given rows to the LanceDB table
        self.table.add(rows)
        # Bump the dataset version atomically
        self.increment_version()

    def update(self, where, values) -> None:
        # Update matching rows in the LanceDB table
        self.table.update(where=where, values=values)
        # Bump the dataset version atomically
        self.increment_version()

    def close(self) -> None:
        try:
            self.client.close()
        except Exception:
            pass

    def __del__(self) -> None:
        self.close()
