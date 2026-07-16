import json
import os
import sys
from solution import search

def test_search():
    # Load config and queries
    with open("/app/data/config.json") as f:
        config = json.load(f)
    with open("/app/data/queries.json") as f:
        queries = json.load(f)
        
    query = queries[0]["query"]
    query_vector = queries[0]["vector"]
    
    print(f"Testing search with query={query}, k=5, keyword_weight=0.5")
    res = search(query, query_vector, k=5, keyword_weight=0.5)
    
    # Assert return type and length
    assert isinstance(res, list), "Result should be a list"
    assert len(res) == 5, f"Expected 5 results, got {len(res)}"
    
    # Check structure
    for doc in res:
        assert "id" in doc, "Document should have key 'id'"
        assert "score" in doc, "Document should have key 'score'"
        assert isinstance(doc["id"], int), "Document ID should be an integer"
        assert isinstance(doc["score"], float), "Document score should be a float"
        print(f"  id: {doc['id']}, score: {doc['score']}")
        
    # Check that balanced doc (id 1) wins at keyword_weight=0.5
    assert res[0]["id"] == 1, f"Expected balanced doc (id 1) to win at keyword_weight=0.5, got {res[0]['id']}"
    
    # Check extreme cases
    # keyword_weight = 1.0 (only BM25 matters)
    res_kw = search(query, query_vector, k=5, keyword_weight=1.0)
    print("keyword_weight = 1.0:")
    for doc in res_kw:
        print(f"  id: {doc['id']}, score: {doc['score']}")
    assert res_kw[0]["id"] == 0, f"Expected kw-champion (id 0) to win at keyword_weight=1.0, got {res_kw[0]['id']}"
    
    # keyword_weight = 0.0 (only Vector matters)
    res_vec = search(query, query_vector, k=5, keyword_weight=0.0)
    print("keyword_weight = 0.0:")
    for doc in res_vec:
        print(f"  id: {doc['id']}, score: {doc['score']}")
    assert res_vec[0]["id"] == 2, f"Expected vec-champion (id 2) to win at keyword_weight=0.0, got {res_vec[0]['id']}"
    
    # Check title weighting vs body weighting
    # With title_weight=8.0, body_weight=1.0
    res_title = search(query, query_vector, k=8, keyword_weight=1.0, title_weight=8.0, body_weight=1.0)
    # With title_weight=1.0, body_weight=8.0
    res_body = search(query, query_vector, k=8, keyword_weight=1.0, title_weight=1.0, body_weight=8.0)
    
    title_ids = [doc["id"] for doc in res_title]
    body_ids = [doc["id"] for doc in res_body]
    
    print(f"Title-weighted IDs: {title_ids}")
    print(f"Body-weighted IDs: {body_ids}")
    
    assert title_ids != body_ids, "Column weighting must change BM25 order"
    assert title_ids.index(4) < title_ids.index(5), "Title weighting must lift the title-only doc (id 4)"
    assert body_ids.index(5) < body_ids.index(4), "Body weighting must lift the body-only doc (id 5)"
    
    print("All tests passed successfully!")

if __name__ == "__main__":
    test_search()
