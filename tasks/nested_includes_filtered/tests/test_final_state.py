import pytest
import os
import socket
import requests
import time
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def start_app(xprocess):
    """
    Starts the Express service using xprocess. Confirms readiness via port check.
    """
    
    # Run npm install before starting the app
    subprocess_result = os.system(f"cd {PROJECT_DIR} && npm install")
    assert subprocess_result == 0, "npm install failed"

    class Starter(ProcessStarter):
        name = "start_app"
        args = ["npm", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", 3000)) == 0

    xprocess.ensure(Starter.name, Starter)

    yield

    info = xprocess.getinfo(Starter.name)
    info.terminate()


def test_seed_database(start_app):
    """Seed the database with test data."""
    seed_payload = [
        {
            "name": "TechCorp",
            "departments": [
                {
                    "name": "Engineering",
                    "status": "active",
                    "employees": [
                        {"name": "Alice", "role": "senior"},
                        {"name": "Bob", "role": "junior"}
                    ]
                },
                {
                    "name": "Sales",
                    "status": "inactive",
                    "employees": [
                        {"name": "Charlie", "role": "senior"}
                    ]
                }
            ]
        },
        {
            "name": "EmptyCorp",
            "departments": []
        }
    ]
    
    response = requests.post("http://localhost:3000/seed", json=seed_payload)
    assert response.status_code == 200, f"Expected status 200 from POST /seed, got {response.status_code}. Response: {response.text}"


def test_verify_filtered_query(start_app):
    """Verify that the filtered query returns the correct nested data."""
    # Ensure the seed test has run first, or sleep a tiny bit if needed
    # (pytest runs tests in order if they are in the same file and no async issues, 
    # but we can rely on the previous test having run because of order, though it's better to be safe.
    # We will assume test_seed_database runs first, but we could also seed here if we wanted to be strictly independent.
    # For simplicity, we just rely on pytest's default alphabetical/line-number execution order).
    
    expected_data = [
        {
            "name": "TechCorp",
            "departments": [
                {
                    "name": "Engineering",
                    "status": "active",
                    "employees": [
                        {"name": "Alice", "role": "senior"}
                    ]
                }
            ]
        },
        {
            "name": "EmptyCorp",
            "departments": []
        }
    ]
    
    response = requests.get("http://localhost:3000/companies/filtered")
    assert response.status_code == 200, f"Expected status 200 from GET /companies/filtered, got {response.status_code}. Response: {response.text}"
    
    actual_data = response.json()
    
    # We only care about the specific structure. The order of companies might be different, 
    # but since we only inserted two, we can just sort by name to compare.
    def sort_data(data):
        for company in data:
            if "departments" in company:
                for dept in company["departments"]:
                    if "employees" in dept:
                        dept["employees"].sort(key=lambda x: x["name"])
                company["departments"].sort(key=lambda x: x["name"])
        data.sort(key=lambda x: x["name"])
        return data
    
    # Also we need to strip out any extra fields like 'id', 'createdAt', 'updatedAt', 'companyId', 'departmentId' 
    # that Sequelize might add, because our expected data only checks the core fields.
    def clean_data(data):
        cleaned = []
        for company in data:
            c = {"name": company.get("name"), "departments": []}
            for dept in company.get("departments", []):
                d = {"name": dept.get("name"), "status": dept.get("status"), "employees": []}
                for emp in dept.get("employees", []):
                    e = {"name": emp.get("name"), "role": emp.get("role")}
                    d["employees"].append(e)
                c["departments"].append(d)
            cleaned.append(c)
        return cleaned

    cleaned_actual = clean_data(actual_data)
    sorted_actual = sort_data(cleaned_actual)
    sorted_expected = sort_data(expected_data)
    
    assert sorted_actual == sorted_expected, f"Filtered data does not match expected.\nExpected: {sorted_expected}\nActual: {sorted_actual}"
