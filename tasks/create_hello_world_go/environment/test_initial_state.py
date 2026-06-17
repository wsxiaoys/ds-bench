import shutil

def test_encore_binary_available():
    assert shutil.which("encore") is not None, "encore binary not found in PATH."

def test_git_binary_available():
    assert shutil.which("git") is not None, "git binary not found in PATH."
