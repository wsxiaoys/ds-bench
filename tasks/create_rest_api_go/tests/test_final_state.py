import os
import re
import requests
import pytest

LOG_FILE = "/home/user/myproject/output.log"

@pytest.fixture(scope="session")
def app_id():
    """Extract App ID from the output log."""
    assert os.path.isfile(LOG_FILE), f"Log file not found at {LOG_FILE}"
    with open(LOG_FILE, "r") as f:
        content = f.read()
    
    match = re.search(r"App ID:\s*([a-zA-Z0-9-]+)", content)
    assert match, "App ID not found in the log file in the format 'App ID: <app-id>'"
    return match.group(1)

def test_log_file_exists():
    """Verify that the log file exists."""
    assert os.path.isfile(LOG_FILE), f"Log file not found at {LOG_FILE}"

def test_create_book(app_id):
    """Test creating a book via POST /books."""
    url = f"https://staging-{app_id}.encr.app/books"
    payload = {"title": "The Hobbit", "author": "Tolkien"}
    
    response = requests.post(url, json=payload)
    assert response.status_code in [200, 201], f"Expected status 200 or 201, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert "id" in data, "Response does not contain 'id' field"
    assert data.get("title") == "The Hobbit", f"Expected title 'The Hobbit', got {data.get('title')}"
    assert data.get("author") == "Tolkien", f"Expected author 'Tolkien', got {data.get('author')}"
    
    # Save the created id for the next test
    pytest.created_book_id = data["id"]

def test_list_books(app_id):
    """Test listing books via GET /books and verifying the created book is present."""
    # Ensure create_book ran successfully
    assert hasattr(pytest, "created_book_id"), "Created book ID not found. The create book test may have failed."
    
    url = f"https://staging-{app_id}.encr.app/books"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert isinstance(data, list), "Expected response to be a JSON array"
    
    # Verify the created book is in the list
    found = False
    for book in data:
        if book.get("id") == pytest.created_book_id:
            assert book.get("title") == "The Hobbit", f"Expected title 'The Hobbit', got {book.get('title')}"
            assert book.get("author") == "Tolkien", f"Expected author 'Tolkien', got {book.get('author')}"
            found = True
            break
            
    assert found, f"Book with id {pytest.created_book_id} not found in the list response"
