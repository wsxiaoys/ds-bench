import os
import sqlite3
import pytest
import requests
import socket
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
DB_PATH = os.path.join(PROJECT_DIR, "database.sqlite")

@pytest.fixture(scope="session")
def app_server(xprocess):
    class Starter(ProcessStarter):
        name = "app_server"
        args = ["node", "index.js"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 3000)) == 0

    info = xprocess.getinfo(Starter.name)
    printed_log_lines = 0  # track how many lines have already been printed

    def capture_logs(tag):
        nonlocal printed_log_lines
        with open(info.logpath, "r") as f:
            all_lines = f.readlines()
        new_lines = all_lines[printed_log_lines:]
        skipped = printed_log_lines
        printed_log_lines = len(all_lines)
        print(f"============================== [{tag}: Begin] Captured {Starter.name} logfile ==============================")
        if skipped > 0:
            print(f"(skipped {skipped} already-printed lines)")
        print("".join(new_lines))
        print(f"============================== [{tag}: End  ] Captured {Starter.name} logfile ==============================")

    started = False
    try:
        # ensure() starts the process and blocks until startup_check is True
        xprocess.ensure(Starter.name, Starter)
        started = True
    finally:
        capture_logs("STARTED" if started else "FAILED")

    yield xprocess
    
    capture_logs("TEARDOWN")
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

def test_create_and_list_user(app_server):
    # Create User
    response = requests.post("http://127.0.0.1:3000/users", json={"username": "alice"})
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    data = response.json()
    assert data.get("username") == "alice", f"Expected username 'alice', got {data.get('username')}"
    
    # List Users
    response = requests.get("http://127.0.0.1:3000/users")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    users = response.json()
    assert isinstance(users, list), "Expected response to be a list"
    assert any(u.get("username") == "alice" for u in users), "Expected user 'alice' in the list"

def test_data_persistence(app_server):
    # Kill the node process
    info = app_server.getinfo("app_server")
    info.terminate()
    
    # Restart the node process
    class Starter(ProcessStarter):
        name = "app_server"
        args = ["node", "index.js"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("127.0.0.1", 3000)) == 0
                
    app_server.ensure(Starter.name, Starter)
    
    # Verify data still exists
    response = requests.get("http://127.0.0.1:3000/users")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    users = response.json()
    assert any(u.get("username") == "alice" for u in users), "Data did not persist across restarts; 'alice' is missing."
