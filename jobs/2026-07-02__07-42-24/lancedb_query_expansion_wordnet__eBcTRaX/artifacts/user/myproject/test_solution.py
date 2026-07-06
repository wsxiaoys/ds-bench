import os
import sys

# Add /home/user/myproject to python path
sys.path.insert(0, "/home/user/myproject")

from solution import expanded_search

def test_expanded_search():
    print("Running tests...")
    
    # Test 1: Search for 'car'
    res_car = expanded_search("car", k=15)
    print(f"expanded_search('car', k=15) returned: {res_car}")
    assert isinstance(res_car, list), "Result must be a list"
    assert all(isinstance(x, int) for x in res_car), "All elements must be ints"
    
    # The car documents are 0..5, and automobile documents are 6..13.
    # A query for 'car' expanded with synonyms should return both!
    for doc_id in range(14):
        assert doc_id in res_car, f"Expected doc ID {doc_id} to be in search results for 'car'"
        
    print("Test 1 passed! Both car and automobile docs were retrieved for query 'car'.")
    
    # Test 2: Search for 'automobile'
    res_auto = expanded_search("automobile", k=15)
    print(f"expanded_search('automobile', k=15) returned: {res_auto}")
    for doc_id in range(14):
        assert doc_id in res_auto, f"Expected doc ID {doc_id} to be in search results for 'automobile'"
        
    print("Test 2 passed! Both car and automobile docs were retrieved for query 'automobile'.")
    
    # Test 3: Search for empty string
    res_empty = expanded_search("", k=10)
    print(f"expanded_search('', k=10) returned: {res_empty}")
    assert res_empty == [], "Expected empty list for empty query"
    print("Test 3 passed! Empty query handled gracefully.")
    
    # Test 4: Search for multiple words
    res_multi = expanded_search("fast car", k=15)
    print(f"expanded_search('fast car', k=15) returned: {res_multi}")
    # Should contain car and automobile docs, and maybe others
    assert len(res_multi) > 0, "Expected some results"
    print("Test 4 passed!")
    
    print("All tests passed successfully!")

if __name__ == "__main__":
    test_expanded_search()
