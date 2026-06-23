import os

def test_initial_state():
    assert not os.path.exists("/home/user/output.txt")
