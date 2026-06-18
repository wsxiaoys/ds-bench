import os
import subprocess
import pytest

PROJECT_DIR = "/home/user/project"

def test_typecheck_passes():
    """Verify that npm run typecheck executes successfully with exit code 0."""
    result = subprocess.run(
        ["npm", "run", "typecheck"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, \
        f"'npm run typecheck' failed. Stdout: {result.stdout}\nStderr: {result.stderr}"

def test_exports_funcA():
    """Verify that convex/a.ts still exports funcA."""
    result = subprocess.run(
        ["grep", "-E", "export const funcA = query", "convex/a.ts"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, \
        "convex/a.ts does not export 'funcA' as a query."

def test_exports_funcB():
    """Verify that convex/b.ts still exports funcB."""
    result = subprocess.run(
        ["grep", "-E", "export const funcB = query", "convex/b.ts"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, \
        "convex/b.ts does not export 'funcB' as a query."

def test_exports_funcC():
    """Verify that convex/c.ts still exports funcC."""
    result = subprocess.run(
        ["grep", "-E", "export const funcC = query", "convex/c.ts"],
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    assert result.returncode == 0, \
        "convex/c.ts does not export 'funcC' as a query."
