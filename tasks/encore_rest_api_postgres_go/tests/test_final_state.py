import os
import re
import requests
import pytest

PROJECT_DIR = "/home/user/taskmanager"

def get_app_id():
    encore_app_path = os.path.join(PROJECT_DIR, "encore.app")
    assert os.path.isfile(encore_app_path), f"encore.app not found at {encore_app_path}"
    
    with open(encore_app_path, "r") as f:
        content = f.read()
    
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match is not None, "Failed to extract app ID from encore.app"
    return match.group(1)

def test_rest_api_crud_operations():
    app_id = get_app_id()
    base_url = f"https://staging-{app_id}.encr.app"
    
    # 1. Create Task 1
    resp1 = requests.post(f"{base_url}/tasks", json={"title": "Task 1", "description": "First task"})
    assert resp1.status_code == 200, f"Failed to create Task 1. Status: {resp1.status_code}, Body: {resp1.text}"
    data1 = resp1.json()
    assert data1.get("title") == "Task 1", "Title mismatch for Task 1"
    assert data1.get("description") == "First task", "Description mismatch for Task 1"
    assert data1.get("done") is False, "Task 1 should default to done=false"
    task1_id = data1.get("id")
    assert task1_id is not None, "Task 1 id is missing"
    
    # 2. Create Task 2
    resp2 = requests.post(f"{base_url}/tasks", json={"title": "Task 2", "description": "Second task"})
    assert resp2.status_code == 200, f"Failed to create Task 2. Status: {resp2.status_code}, Body: {resp2.text}"
    data2 = resp2.json()
    assert data2.get("title") == "Task 2", "Title mismatch for Task 2"
    assert data2.get("description") == "Second task", "Description mismatch for Task 2"
    assert data2.get("done") is False, "Task 2 should default to done=false"
    task2_id = data2.get("id")
    assert task2_id is not None, "Task 2 id is missing"
    
    # 3. List Tasks
    resp_list = requests.get(f"{base_url}/tasks")
    assert resp_list.status_code == 200, f"Failed to list tasks. Status: {resp_list.status_code}, Body: {resp_list.text}"
    list_data = resp_list.json()
    tasks = list_data.get("tasks", [])
    task_ids = [t.get("id") for t in tasks]
    assert task1_id in task_ids, f"Task 1 (id: {task1_id}) not found in listed tasks"
    assert task2_id in task_ids, f"Task 2 (id: {task2_id}) not found in listed tasks"
    
    # 4. Get Task 1
    resp_get1 = requests.get(f"{base_url}/tasks/{task1_id}")
    assert resp_get1.status_code == 200, f"Failed to get Task 1. Status: {resp_get1.status_code}, Body: {resp_get1.text}"
    get1_data = resp_get1.json()
    assert get1_data.get("id") == task1_id, "ID mismatch in Get Task 1"
    assert get1_data.get("title") == "Task 1", "Title mismatch in Get Task 1"
    
    # 5. Update Task 1
    resp_update1 = requests.put(f"{base_url}/tasks/{task1_id}", json={
        "title": "Updated Task 1",
        "description": "Updated description",
        "done": True
    })
    assert resp_update1.status_code == 200, f"Failed to update Task 1. Status: {resp_update1.status_code}, Body: {resp_update1.text}"
    update1_data = resp_update1.json()
    assert update1_data.get("title") == "Updated Task 1", "Title was not updated"
    assert update1_data.get("done") is True, "Done status was not updated"
    
    # 6. Delete Task 2
    resp_delete2 = requests.delete(f"{base_url}/tasks/{task2_id}")
    assert resp_delete2.status_code == 200, f"Failed to delete Task 2. Status: {resp_delete2.status_code}, Body: {resp_delete2.text}"
    
    # 7. Verify Deletion
    resp_list2 = requests.get(f"{base_url}/tasks")
    assert resp_list2.status_code == 200, f"Failed to list tasks after deletion. Status: {resp_list2.status_code}, Body: {resp_list2.text}"
    list_data2 = resp_list2.json()
    tasks2 = list_data2.get("tasks", [])
    task_ids2 = [t.get("id") for t in tasks2]
    assert task1_id in task_ids2, "Task 1 should still exist"
    assert task2_id not in task_ids2, "Task 2 should have been deleted"
