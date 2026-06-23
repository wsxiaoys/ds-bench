import os

def test_initial_state():
    try:
        import e2b_code_interpreter
    except ImportError:
        assert False, "e2b_code_interpreter is not installed"
    
    assert not os.path.exists("/workspace/host_out1.txt"), "host_out1.txt should not exist initially"
    assert not os.path.exists("/workspace/host_out2.txt"), "host_out2.txt should not exist initially"
