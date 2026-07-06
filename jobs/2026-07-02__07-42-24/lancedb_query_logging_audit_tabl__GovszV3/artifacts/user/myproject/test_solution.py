import os
import shutil
import unittest
import numpy as np
import lancedb
import pyarrow as pa
import datetime
from solution import LoggedSearcher

class TestLoggedSearcher(unittest.TestCase):
    def setUp(self):
        # Create a temporary database directory for clean testing
        self.test_db_dir = "/tmp/test_logged_searcher_db"
        if os.path.exists(self.test_db_dir):
            shutil.rmtree(self.test_db_dir)
            
        self.db = lancedb.connect(self.test_db_dir)
        
        # Create a mock articles table
        # 64-dimensional embeddings
        schema = pa.schema([
            pa.field("id", pa.int64()),
            pa.field("title", pa.string()),
            pa.field("embedding", pa.list_(pa.float32(), 64))
        ])
        self.articles_table_name = "articles"
        self.logs_table_name = "query_logs"
        
        self.articles_table = self.db.create_table(self.articles_table_name, schema=schema)
        
        # Insert some dummy articles
        np.random.seed(42)
        data = []
        for i in range(1, 11):
            emb = np.random.randn(64).astype(np.float32).tolist()
            data.append({
                "id": i,
                "title": f"Article #{i:03d}",
                "embedding": emb
            })
        self.articles_table.add(data)

    def tearDown(self):
        # Clean up temporary database
        if os.path.exists(self.test_db_dir):
            shutil.rmtree(self.test_db_dir)

    def test_lazy_table_creation(self):
        # Initialize LoggedSearcher
        # The logs table should NOT exist initially in the database
        self.assertNotIn(self.logs_table_name, self.db.table_names())
        
        searcher = LoggedSearcher(self.test_db_dir, self.articles_table_name, self.logs_table_name)
        
        # Still should not exist before search is called
        self.assertNotIn(self.logs_table_name, self.db.table_names())
        
        # Perform search
        query_vector = np.random.randn(64).astype(np.float32).tolist()
        hits = searcher.search(query_vector, top_k=3, query_id="q-123", user_id="u-456", query_text="machine learning")
        
        # Now the logs table MUST exist
        self.assertIn(self.logs_table_name, self.db.table_names())
        
        # Check logs table schema and contents
        logs_tbl = self.db.open_table(self.logs_table_name)
        schema = logs_tbl.schema
        
        # Check field names
        field_names = schema.names
        self.assertIn("query_id", field_names)
        self.assertIn("user_id", field_names)
        self.assertIn("query_text", field_names)
        self.assertIn("ts", field_names)
        self.assertIn("latency_ms", field_names)
        self.assertIn("hit_count", field_names)
        self.assertIn("top_ids", field_names)
        
        # Check field types
        self.assertEqual(schema.field("query_id").type, pa.string())
        self.assertEqual(schema.field("user_id").type, pa.string())
        self.assertEqual(schema.field("query_text").type, pa.string())
        self.assertTrue(pa.types.is_timestamp(schema.field("ts").type))
        self.assertEqual(schema.field("latency_ms").type, pa.float64())
        self.assertEqual(schema.field("hit_count").type, pa.int64())
        self.assertEqual(schema.field("top_ids").type, pa.list_(pa.int64()))
        
        # Verify row contents
        logged_data = logs_tbl.to_arrow().to_pydict()
        self.assertEqual(len(logged_data["query_id"]), 1)
        self.assertEqual(logged_data["query_id"][0], "q-123")
        self.assertEqual(logged_data["user_id"][0], "u-456")
        self.assertEqual(logged_data["query_text"][0], "machine learning")
        self.assertEqual(logged_data["hit_count"][0], 3)
        self.assertTrue(logged_data["latency_ms"][0] > 0.0)
        
        # Verify top_ids match hits
        hit_ids = [hit["id"] for hit in hits]
        self.assertEqual(logged_data["top_ids"][0], hit_ids)
        
        # Verify ts is timestamp and timezone aware or correct
        ts_val = logged_data["ts"][0]
        self.assertTrue(isinstance(ts_val, datetime.datetime))

    def test_search_results_match_direct_call(self):
        searcher = LoggedSearcher(self.test_db_dir, self.articles_table_name, self.logs_table_name)
        query_vector = np.random.randn(64).astype(np.float32).tolist()
        
        # Direct call
        direct_hits = self.articles_table.search(query_vector).limit(5).to_list()
        
        # LoggedSearcher call
        logged_hits = searcher.search(query_vector, top_k=5, query_id="q-abc", user_id="u-xyz")
        
        # Compare hits
        self.assertEqual(len(direct_hits), len(logged_hits))
        for h1, h2 in zip(direct_hits, logged_hits):
            self.assertEqual(h1["id"], h2["id"])
            self.assertEqual(h1["title"], h2["title"])
            self.assertEqual(h1["_distance"], h2["_distance"])

    def test_multiple_searches_append_logs(self):
        searcher = LoggedSearcher(self.test_db_dir, self.articles_table_name, self.logs_table_name)
        query_vector = np.random.randn(64).astype(np.float32).tolist()
        
        # Perform 3 searches
        searcher.search(query_vector, top_k=2, query_id="q1", user_id="u1", query_text="first")
        searcher.search(query_vector, top_k=1, query_id="q2", user_id="u2", query_text="second")
        searcher.search(query_vector, top_k=4, query_id="q3", user_id="u3", query_text="third")
        
        logs_tbl = self.db.open_table(self.logs_table_name)
        logged_data = logs_tbl.to_arrow().to_pydict()
        
        self.assertEqual(len(logged_data["query_id"]), 3)
        self.assertEqual(logged_data["query_id"], ["q1", "q2", "q3"])
        self.assertEqual(logged_data["user_id"], ["u1", "u2", "u3"])
        self.assertEqual(logged_data["query_text"], ["first", "second", "third"])
        self.assertEqual(logged_data["hit_count"], [2, 1, 4])
        
        # Check all top_ids are lists of integers
        for ids in logged_data["top_ids"]:
            self.assertTrue(all(isinstance(x, int) for x in ids))

if __name__ == "__main__":
    unittest.main()
