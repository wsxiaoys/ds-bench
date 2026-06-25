import os
import sqlite3
import pytest
import requests
import socket
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
DB_PATH = os.path.join(PROJECT_DIR, "database.sqlite")

@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

@pytest.fixture(scope="session")
def app_server(xprocess, app_port):
    class Starter(ProcessStarter):
        name = "app_server"
        args = ["node", "index.js", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", app_port)) == 0

    pid, logpath = xprocess.ensure(Starter.name, Starter)

    # print the logs after the service has started
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile after started =============================")
        print(logs)
        print("===== End: Captured xprocess logfile after started =============================")

    yield xprocess

    # teardown: print the logs and terminate the service
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile when teardown =============================")
        print(logs)
        print("===== End: Captured xprocess logfile when teardown =============================")

    info = xprocess.getinfo(Starter.name)
    if info.isrunning():
        info.terminate()

def test_sync_removed():
    index_js_path = os.path.join(PROJECT_DIR, "index.js")
    with open(index_js_path, "r") as f:
        content = f.read()
    assert "sync(" not in content, "Expected sync() to be removed from index.js"

def test_migrations_exist():
    assert os.path.isfile(DB_PATH), f"Database file {DB_PATH} does not exist."
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='SequelizeMeta';")
        table = cursor.fetchone()
        assert table is not None, "SequelizeMeta table does not exist. Migrations were not used."
        
        cursor.execute("SELECT * FROM SequelizeMeta;")
        records = cursor.fetchall()
        assert len(records) > 0, "No migration records found in SequelizeMeta table."
    finally:
        conn.close()

def test_create_and_list_user(app_server, app_port):
    # Create User
    response = requests.post(f"http://localhost:{app_port}/users", json={"username": "alice"})
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    data = response.json()
    assert data.get("username") == "alice", f"Expected username 'alice', got {data.get('username')}"
    
    # List Users
    response = requests.get(f"http://localhost:{app_port}/users")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    users = response.json()
    assert isinstance(users, list), "Expected response to be a list"
    assert any(u.get("username") == "alice" for u in users), "Expected user 'alice' in the list"

def test_data_persistence(app_server, app_port):
    # Kill the node process
    info = app_server.getinfo("app_server")
    info.terminate()
    
    # Restart the node process
    class Starter(ProcessStarter):
        name = "app_server"
        args = ["node", "index.js", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", app_port)) == 0
                
    pid, logpath = app_server.ensure(Starter.name, Starter)

    # print the logs after the service has started
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile after started =============================")
        print(logs)
        print("===== End: Captured xprocess logfile after started =============================")
    
    # Verify data still exists
    try:
        response = requests.get(f"http://localhost:{app_port}/users")
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        users = response.json()
        assert any(u.get("username") == "alice" for u in users), "Data did not persist across restarts; 'alice' is missing."
    finally:
        with open(logpath, "r") as f:
            logs = f.read()
            print("=== Begin: Captured xprocess logfile when teardown =============================")
            print(logs)
            print("===== End: Captured xprocess logfile when teardown =============================")
