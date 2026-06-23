import os

def test_host_out1():
    assert os.path.exists("/workspace/host_out1.txt"), "/workspace/host_out1.txt was not created"
    with open("/workspace/host_out1.txt", "r") as f:
        content = f.read().strip()
    assert content == "42", f"Expected '42' in host_out1.txt, but got '{content}'"

def test_host_out2():
    assert os.path.exists("/workspace/host_out2.txt"), "/workspace/host_out2.txt was not created"
    with open("/workspace/host_out2.txt", "r") as f:
        content = f.read().strip()
    assert content == "99", f"Expected '99' in host_out2.txt, but got '{content}'"
