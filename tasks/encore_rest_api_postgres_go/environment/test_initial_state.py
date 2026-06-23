import os
import shutil
import pytest

def test_encore_binary_available():
    assert shutil.which("encore") is not None, "encore binary not found in PATH."

def test_git_binary_available():
    assert shutil.which("git") is not None, "git binary not found in PATH."

def test_go_binary_available():
    assert shutil.which("go") is not None, "go binary not found in PATH."

def test_auth_token_env_var_set():
    assert "ENCORE_AUTH_TOKEN_JSON" in os.environ, "ENCORE_AUTH_TOKEN_JSON environment variable is not set."
