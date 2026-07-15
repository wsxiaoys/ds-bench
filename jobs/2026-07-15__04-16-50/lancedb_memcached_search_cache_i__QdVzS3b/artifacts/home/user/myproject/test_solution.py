import os
import json
import unittest
from unittest.mock import patch
import numpy as np
from pymemcache.client.base import Client

from solution import CachedSearcher

class TestCachedSearcher(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Read fixture config
        with open("/home/user/myproject/fixture.json") as f:
            cls.fixture = json.load(f)
        cls.db_path = cls.fixture["db_path"]
        cls.table_name = cls.fixture["table_name"]
        cls.dim = cls.fixture["dim"]
        
        # Connect directly to memcached to clear it before tests
        cls.mc = Client(("127.0.0.1", 11211))
        cls.mc.flush_all()

    def setUp(self):
        # Flush memcached before each test to ensure isolation
        self.mc.flush_all()
        # Instantiate CachedSearcher
        self.searcher = CachedSearcher(self.db_path, self.table_name)

    def tearDown(self):
        self.searcher.close()

    @classmethod
    def tearDownClass(cls):
        cls.mc.close()

    def test_basic_search_cache_hit_miss(self):
        query_vector = [0.1] * self.dim
        
        # First search: should be a cache miss. Let's patch checkout_latest to track calls
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            res1 = self.searcher.search(query_vector, k=5)
            self.assertEqual(len(res1), 5)
            self.assertTrue(mock_checkout.called, "checkout_latest should be called on a cache miss")
            
            # Check fields
            for item in res1:
                self.assertIn('id', item)
                self.assertIn('category', item)
                self.assertIn('_distance', item)
                self.assertIsInstance(item['id'], int)
                self.assertIsInstance(item['category'], str)
                self.assertIsInstance(item['_distance'], float)
                
            # Verify they are ordered by ascending _distance
            distances = [item['_distance'] for item in res1]
            self.assertEqual(distances, sorted(distances))

        # Second search with same params: should be a cache hit.
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            res2 = self.searcher.search(query_vector, k=5)
            self.assertFalse(mock_checkout.called, "checkout_latest should NOT be called on a cache hit")
            self.assertEqual(res1, res2, "Results from cache hit must be identical to cache miss")

    def test_search_with_filter(self):
        query_vector = [0.2] * self.dim
        filter_str = "category = 'A'"
        
        res1 = self.searcher.search(query_vector, k=5, filter=filter_str)
        for item in res1:
            self.assertEqual(item['category'], 'A')
            
        # Verify hit works with filter
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            res2 = self.searcher.search(query_vector, k=5, filter=filter_str)
            self.assertFalse(mock_checkout.called)
            self.assertEqual(res1, res2)

    def test_invalidation_on_add(self):
        query_vector = [0.3] * self.dim
        
        # 1. Miss and populate cache
        res1 = self.searcher.search(query_vector, k=5)
        
        # Verify hit
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            self.searcher.search(query_vector, k=5)
            self.assertFalse(mock_checkout.called)
            
        # 2. Add a new row
        new_row = {
            "id": 10001,
            "category": "B",
            "vector": [0.3] * self.dim
        }
        self.searcher.add([new_row])
        
        # 3. Next search should be a miss because the version is bumped
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            res2 = self.searcher.search(query_vector, k=5)
            self.assertTrue(mock_checkout.called, "Should miss cache after add")
            
        # The new row has distance 0 to query_vector, so it should be the first result
        self.assertEqual(res2[0]['id'], 10001)
        self.assertAlmostEqual(res2[0]['_distance'], 0.0, places=5)
        
        # Clean up the added row
        self.searcher.table.delete("id = 10001")

    def test_invalidation_on_update(self):
        query_vector = [0.4] * self.dim
        
        # Search for category B
        res1 = self.searcher.search(query_vector, k=5, filter="category = 'B'")
        
        # Add a test row we can update
        test_row = {
            "id": 10002,
            "category": "C",
            "vector": [0.4] * self.dim
        }
        self.searcher.add([test_row])
        
        # Search with category B: should be a hit (not affected by test_row addition if we query category B,
        # but wait, adding a row bumps the version, so it actually invalidates all cache keys for the table!).
        # Let's verify that a search now is indeed a miss.
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            res_b = self.searcher.search(query_vector, k=5, filter="category = 'B'")
            self.assertTrue(mock_checkout.called)
            
        # Update the test row's category to B
        self.searcher.update(where="id = 10002", values={"category": "B"})
        
        # Search for category B: should be a miss, and test_row should now be in the results (with distance 0)
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            res_b_after = self.searcher.search(query_vector, k=5, filter="category = 'B'")
            self.assertTrue(mock_checkout.called)
            self.assertEqual(res_b_after[0]['id'], 10002)
            
        # Clean up
        self.searcher.table.delete("id = 10002")

    def test_cross_instance_invalidation(self):
        # Create a second searcher instance pointing to the same table
        searcher2 = CachedSearcher(self.db_path, self.table_name)
        
        query_vector = [0.5] * self.dim
        
        # 1. Searcher 1 misses and populates cache
        res1 = self.searcher.search(query_vector, k=5)
        
        # 2. Searcher 2 hits cache (because it shares memcached and table version)
        with patch.object(searcher2.table, 'checkout_latest', wraps=searcher2.table.checkout_latest) as mock_checkout:
            res2 = searcher2.search(query_vector, k=5)
            self.assertFalse(mock_checkout.called)
            self.assertEqual(res1, res2)
            
        # 3. Searcher 2 adds a row (invalidating the version)
        new_row = {
            "id": 10003,
            "category": "E",
            "vector": [0.5] * self.dim
        }
        searcher2.add([new_row])
        
        # 4. Searcher 1 searches again: should miss and see the new row!
        with patch.object(self.searcher.table, 'checkout_latest', wraps=self.searcher.table.checkout_latest) as mock_checkout:
            res3 = self.searcher.search(query_vector, k=5)
            self.assertTrue(mock_checkout.called)
            self.assertEqual(res3[0]['id'], 10003)
            
        # Clean up
        searcher2.table.delete("id = 10003")

if __name__ == "__main__":
    unittest.main()
